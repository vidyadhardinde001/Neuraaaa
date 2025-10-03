use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use sha2::{Sha256, Digest};
use tauri::command;

#[derive(Debug, serde::Serialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<String>,
}

/// Compute SHA-256 hash of a file
fn file_hash(path: &PathBuf) -> io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192]; // larger buffer for fewer syscalls
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Step 1: Group by file size
/// Step 2: Hash only files that share the same size
#[command]
pub fn find_duplicate_files(dir: String) -> Result<Vec<DuplicateGroup>, String> {
    let mut size_map: HashMap<u64, Vec<PathBuf>> = HashMap::new();

    // Only scan files directly in the given directory (not recursively)
    let read_dir = match fs::read_dir(&dir) {
        Ok(rd) => rd,
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    };
    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_file() {
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                size_map.entry(size).or_default().push(path);
            }
        }
    }

    // Now, only hash files that share the same size
    let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();

    for (_size, files) in size_map {
        if files.len() < 2 {
            continue; // skip unique-sized files
        }

        for path in files {
            match file_hash(&path) {
                Ok(hash) => {
                    hash_map.entry(hash).or_default().push(path.to_string_lossy().to_string());
                }
                Err(_) => continue,
            }
        }
    }

    // Collect only duplicates
    let duplicates = hash_map
        .into_iter()
        .filter_map(|(hash, files)| {
            if files.len() > 1 {
                Some(DuplicateGroup { hash, files })
            } else {
                None
            }
        })
        .collect();

    Ok(duplicates)
}

/// Deletes multiple files safely
#[command]
pub fn delete_files(files: Vec<String>) -> Result<(), String> {
    for file in files {
        if let Err(e) = fs::remove_file(&file) {
            return Err(format!("Failed to delete {}: {}", file, e));
        }
    }
    Ok(())
}
