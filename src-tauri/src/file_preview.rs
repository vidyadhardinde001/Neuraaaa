use std::fs;
use std::path::PathBuf;
use tauri::command;
use base64::{engine::general_purpose, Engine as _};
use zip::read::ZipArchive;
use serde_json;
use std::io::Cursor;
use regex::Regex;
use std::time::SystemTime;
use chrono::{DateTime, Local};

/// Maximum size for text preview (500 KB)
const MAX_TEXT_PREVIEW: usize = 2_000_000;

#[command]
pub fn preview_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(path);

    let metadata = fs::metadata(&p).map_err(|e| format!("Failed to read metadata: {}", e))?;
    if metadata.len() as usize > MAX_TEXT_PREVIEW {
        return Err("File too large to preview".to_string());
    }

    // Handle docx / pptx (zip-based Office Open XML)
    if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
        let ext = ext.to_lowercase();
        if ext == "docx" || ext == "pptx" {
            let bytes = fs::read(&p).map_err(|_| "Failed to read file".to_string())?;
            let reader = Cursor::new(bytes);
            let mut archive = ZipArchive::new(reader).map_err(|_| "Failed to read archive".to_string())?;

            // score docx -> document.xml, pptx -> slides/slideN.xml
            let mut collected = String::new();
            if ext == "docx" {
                if let Ok(mut file) = archive.by_name("word/document.xml") {
                    let mut s = String::new();
                    use std::io::Read;
                    file.read_to_string(&mut s).ok();
                    // strip XML tags
                    let re = Regex::new(r"<[^>]+>").unwrap();
                    collected.push_str(&re.replace_all(&s, " ").to_string());
                }
            } else {
                // pptx: iterate slides
                for i in 1..=50u8 { // limit slides
                    let name = format!("ppt/slides/slide{}.xml", i);
                    if let Ok(mut file) = archive.by_name(&name) {
                        let mut s = String::new();
                        use std::io::Read;
                        file.read_to_string(&mut s).ok();
                        let re = Regex::new(r"<[^>]+>").unwrap();
                        collected.push_str(&re.replace_all(&s, " ").to_string());
                    } else {
                        break;
                    }
                }
            }

            if collected.is_empty() {
                return Err("No text extracted from docx/pptx".to_string());
            }
            // trim and limit size
            let out = if collected.len() > MAX_TEXT_PREVIEW { collected[..MAX_TEXT_PREVIEW].to_string() } else { collected };
            return Ok(out);
        }
    }

    fs::read_to_string(&p).map_err(|_| "Failed to read file as text".to_string())
}

#[command]
pub fn preview_binary_file(path: String) -> Result<(String, String), String> {
    let p = PathBuf::from(path.clone());

    let metadata = fs::metadata(&p).map_err(|e| format!("Failed to read metadata: {}", e))?;
    if metadata.len() as usize > MAX_TEXT_PREVIEW * 4 { // larger threshold for binaries (~2MB)
        return Err("File too large to preview".to_string());
    }

    let data = fs::read(&p).map_err(|_| "Failed to read file".to_string())?;

    // attempt a basic mime guess from extension
    let mime = match p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        _ => "application/octet-stream",
    };

    let encoded = general_purpose::STANDARD.encode(&data);
    Ok((encoded, mime.to_string()))
}

#[command]
pub fn metadata_for_path(path: String) -> Result<serde_json::Value, String> {
    use std::fs::metadata;
    use serde_json::json;

    let p = PathBuf::from(path);
    let md = metadata(&p).map_err(|e| format!("Failed to stat file: {}", e))?;

    // local helper to avoid depending on explorer's private function
    fn system_time_to_string_opt(st: std::time::SystemTime) -> String {
        let datetime: DateTime<Local> = st.into();
        datetime.format("%Y-%m-%d %H:%M:%S").to_string()
    }

    let created = md
        .created()
        .ok()
        .map(|t| system_time_to_string_opt(t))
        .unwrap_or_default();
    let modified = md
        .modified()
        .ok()
        .map(|t| system_time_to_string_opt(t))
        .unwrap_or_default();

    let out = json!({
        "size": md.len(),
        "created": if created.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(created) },
        "modified": if modified.is_empty() { serde_json::Value::Null } else { serde_json::Value::String(modified) }
    });

    Ok(out)
}
