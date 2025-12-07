use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use walkdir::WalkDir;
use tauri::Window;
use tauri::Emitter;
use rayon::prelude::*;
use sha2::{Sha256, Digest};
use tauri::command;

#[derive(Debug, serde::Serialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct DuplicateProgress {
    pub scanned: usize,
    pub candidates: usize,
    pub duplicates_found: usize,
}

fn file_hash(path: &PathBuf) -> io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192]; 
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[command]
pub fn find_duplicate_files(window: Window, dir: String) -> Result<Vec<DuplicateGroup>, String> {
    let mut size_map: HashMap<u64, Vec<PathBuf>> = HashMap::new();

    let mut scanned: usize = 0;
    for entry in WalkDir::new(&dir).into_iter() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path().to_path_buf();
        if path.is_file() {
            scanned += 1;
            if let Ok(metadata) = fs::metadata(&path) {
                let size = metadata.len();
                size_map.entry(size).or_default().push(path);
            }

            if scanned % 250 == 0 {
                let progress = DuplicateProgress {
                    scanned: scanned as usize,
                    candidates: size_map.iter().map(|(_, v)| v.len()).sum(),
                    duplicates_found: 0, 
                };

                let _ = window.emit("duplicate_progress", &progress);
            }
        }
    }

    let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();

    for (_size, files) in size_map {
        if files.len() < 2 {
            continue;
        }
        let results: Vec<(String, Option<String>)> = files
            .par_iter()
            .map(|p| {
                match file_hash(p) {
                    Ok(h) => (p.to_string_lossy().to_string(), Some(h)),
                    Err(_) => (p.to_string_lossy().to_string(), None),
                }
            })
            .collect();

        for (path_str, maybe_hash) in results {
            if let Some(hash) = maybe_hash {
                hash_map.entry(hash).or_default().push(path_str);
            }
        }

        let duplicates_count: usize = hash_map.values().filter(|v| v.len() > 1).count();
        let progress = DuplicateProgress {
            scanned: scanned as usize,
            candidates: hash_map.values().map(|v| v.len()).sum(),
            duplicates_found: duplicates_count,
        };
        let _ = window.emit("duplicate_progress", &progress);
    }

    let duplicates: Vec<DuplicateGroup> = hash_map
        .into_iter()
        .filter_map(|(hash, files)| {
            if files.len() > 1 {
                Some(DuplicateGroup { hash, files })
            } else {
                None
            }
        })
        .collect();

    let final_progress = DuplicateProgress {
        scanned: scanned as usize,
        candidates: duplicates.iter().map(|g: &DuplicateGroup| g.files.len()).sum(),
        duplicates_found: duplicates.len(),
    };
    let _ = window.emit("duplicate_progress", &final_progress);

    Ok(duplicates)
}


#[command]
pub fn delete_files(files: Vec<String>) -> Result<(), String> {
    for file in files {
        if let Err(e) = fs::remove_file(&file) {
            return Err(format!("Failed to delete {}: {}", file, e));
        }
    }
    Ok(())
}
