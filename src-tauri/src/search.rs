use crate::filesystem::volume::{DirectoryChild, FileMeta};
use crate::StateSafe;
use tauri::Emitter;
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use std::path::Path;
use std::time::{Instant, SystemTime};
use tauri::{State, Window};
use serde::Serialize;

const MINIMUM_SCORE: i16 = 100;

/// Wrapper for sending child + fuzzy score to frontend
#[derive(Serialize, Clone)]
pub struct ScoredChild {
    pub child: DirectoryChild,
    pub score: i16,
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

/// Reads the cache and does a fuzzy search for a directory.
/// Takes into account the filters provided.
/// Returns the results ONLY when the entire volume is searched
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

    // Generate a new search_id and mark it as active
    let search_id = {
        let state = state_mux.lock().unwrap();
        state.active_search_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1
    };

    let query_lower = query.to_lowercase();

    // Get cache snapshot
    let system_cache = {
        let state = state_mux.lock().unwrap();
        state.system_cache.get(&mount_pnt).cloned()
    };

    if system_cache.is_none() {
        return Ok(()); // nothing to search
    }
    let system_cache = system_cache.unwrap();

    for (filename, paths) in system_cache {
        for path in paths {
            // ✅ Check if another search started -> cancel
            let current_id = {
                let state = state_mux.lock().unwrap();
                state.active_search_id.load(std::sync::atomic::Ordering::SeqCst)
            };
            if current_id != search_id {
                return Ok(()); // stop this search early
            }

            let file_path = &path.file_path;
            let file_type = &path.file_type;

            if !file_path.starts_with(&search_directory) {
                continue;
            }

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
        let _ = window.emit("search_finished", elapsed_ms);
    }

    Ok(())
}
