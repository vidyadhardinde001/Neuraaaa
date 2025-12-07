    use crate::filesystem::volume::{DirectoryChild, FileMeta};
    use crate::StateSafe;
    use tauri::Emitter;
    use fuzzy_matcher::skim::SkimMatcherV2;
    use fuzzy_matcher::FuzzyMatcher;
    use std::path::Path;
    use std::time::{Instant, SystemTime};
    use std::collections::HashMap;
    use tauri::{State, Window};
    use serde::Serialize;

    const MINIMUM_SCORE: i16 = 100;

    /// Wrapper for sending child + fuzzy score to frontend
    #[derive(Serialize, Clone)]
    pub struct ScoredChild {
        pub child: DirectoryChild,
        pub score: i16,
    }

    #[derive(Serialize, Clone)]
    pub struct SearchProgress {
        pub scanned: u64,
        pub matched: u64,
        pub counts_by_type: HashMap<String, u64>,
        pub counts_by_extension: HashMap<String, u64>,
    }

    #[derive(Serialize, Clone)]
    pub struct SearchFinished {
        pub elapsed_ms: u64,
        pub scanned: u64,
        pub matched: u64,
        pub counts_by_type: HashMap<String, u64>,
        pub counts_by_extension: HashMap<String, u64>,
    }

    /// Checks if the filename passes the extension filter, also checks if extension filter is provided.
    fn passed_extension(filename: &str, extension: &String) -> bool {
        if extension.is_empty() {
            return true;
        }
        filename.ends_with(extension.as_str())
    }

    /// Gives a filename a fuzzy matcher score
    /// Returns 1000 if there is an exact match for prioritizing
    fn score_filename(matcher: &SkimMatcherV2, filename: &str, query: &str) -> i16 {
        let filename_lower = filename.to_lowercase();
        let query_lower = query.to_lowercase();

        // Exact continuous substring of at least 5 chars
        if query_lower.len() >= 5 && filename_lower.contains(&query_lower) {
            return 1000;
        }

        // Fuzzy match for other cases
        let score = matcher.fuzzy_match(&filename_lower, &query_lower).unwrap_or(0) as i16;

        if score < 150 { // set a threshold to ignore very weak fuzzy matches
            return 0;
        }

        score
    }


    fn check_file(
        matcher: &SkimMatcherV2,
        accept_files: bool,
        filename: &String,
        file_path: &String,
        extension: &String,
        query: String,
        results: &mut Vec<DirectoryChild>,
        fuzzy_scores: &mut Vec<i16>,
    ) {
        if !accept_files {
            return;
        }
        if !passed_extension(filename, extension) {
            return;
        }

        let filename_path = Path::new(filename);
        let cleaned_filename = filename_path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("");

        let score = score_filename(matcher, cleaned_filename, query.as_str());
        if score < MINIMUM_SCORE {
            return;
        }

        // ✅ FileMeta with Option<SystemTime>
        let meta = FileMeta {
            name: filename.clone(),
            path: file_path.clone(),
            size: 0,
            created: None,
            modified: None,
            is_dir: false,
        };

        results.push(DirectoryChild::File(meta));
        fuzzy_scores.push(score);
    }

    #[tauri::command]
    pub async fn search_directory(
        window: Window,
        state_mux: State<'_, StateSafe>,
        query: String,
        search_directory: String,
        mount_pnt: String,
        extension: String,
        accept_files: bool,
        accept_directories: bool,
    ) -> Result<(), ()> {
        let start = Instant::now();
        let matcher = SkimMatcherV2::default().smart_case();

        let search_id = {
            let state = state_mux.lock().unwrap();
            state.active_search_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1
        };

        let query_lower = query.to_lowercase();

        let system_cache = {
            let state = state_mux.lock().unwrap();
            state.system_cache.get(&mount_pnt).cloned()
        };

        if system_cache.is_none() {
            return Ok(()); 
        }
        let system_cache = system_cache.unwrap();

        let mut scanned_count: u64 = 0;
        let mut matched_count: u64 = 0;
        let mut counts_by_type: HashMap<String, u64> = HashMap::new();
        let mut counts_by_extension: HashMap<String, u64> = HashMap::new();

        let mut since_last_emit: u64 = 0;

        for (filename, paths) in system_cache {
            for path in paths {

                let current_id = {
                    let state = state_mux.lock().unwrap();
                    state.active_search_id.load(std::sync::atomic::Ordering::SeqCst)
                };
                if current_id != search_id {
                    return Ok(()); 
                }

                let file_path = &path.file_path;
                let file_type = &path.file_type;

                if !file_path.starts_with(&search_directory) {
                    continue;
                }

                // Update scanned counters / maps
                scanned_count += 1;
                since_last_emit += 1;
                *counts_by_type.entry(file_type.clone()).or_insert(0) += 1;

                // count by extension (if present)
                let ext = Path::new(&filename)
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_else(|| String::from("<no-ext>"));
                *counts_by_extension.entry(ext).or_insert(0) += 1;

                let score = score_filename(&matcher, &filename, &query_lower);
                if score < MINIMUM_SCORE {
                    continue;
                }

                if file_type == "file" && accept_files {
                    let meta = FileMeta {
                        name: filename.clone(),
                        path: file_path.clone(),
                        size: 0,
                        created: None,
                        modified: None,
                        is_dir: false,
                    };
                    let scored = ScoredChild {
                        child: DirectoryChild::File(meta),
                        score,
                    };
                    let _ = window.emit("search_result", scored);
                    matched_count += 1;
                } else if file_type == "directory" && accept_directories {
                    let meta = FileMeta {
                        name: filename.clone(),
                        path: file_path.clone(),
                        size: 0,
                        created: None,
                        modified: None,
                        is_dir: true,
                    };
                    let scored = ScoredChild {
                        child: DirectoryChild::Directory(meta),
                        score,
                    };
                    let _ = window.emit("search_result", scored);
                    matched_count += 1;
                }

                // Emit progress occasionally to keep frontend updated
                if since_last_emit >= 500 {
                    since_last_emit = 0;
                    let progress = SearchProgress {
                        scanned: scanned_count,
                        matched: matched_count,
                        counts_by_type: counts_by_type.clone(),
                        counts_by_extension: counts_by_extension.clone(),
                    };
                    let _ = window.emit("search_progress", progress);
                }
            }
        }

        // ✅ Only finish if this search wasn't cancelled
        let current_id = {
            let state = state_mux.lock().unwrap();
            state.active_search_id.load(std::sync::atomic::Ordering::SeqCst)
        };
        if current_id == search_id {
            let elapsed_ms = start.elapsed().as_millis() as u64;

            // emit final progress before finishing
            let final_stats = SearchFinished {
                elapsed_ms,
                scanned: scanned_count,
                matched: matched_count,
                counts_by_type: counts_by_type.clone(),
                counts_by_extension: counts_by_extension.clone(),
            };

            let _ = window.emit("search_finished", final_stats);
        }

        Ok(())
    }
