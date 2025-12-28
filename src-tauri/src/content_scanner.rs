/**
 * Content Scanner Module
 *
 * Analyzes files locally to detect sensitive content:
 * - ID numbers (SSN, national IDs, passport)
 * - Credit card / financial patterns
 * - Passwords, keys, credentials
 * - Private metadata
 * - High-risk file types (financial docs, images, etc.)
 *
 * All analysis is local; no data leaves the device.
 */

use regex::Regex;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SensitiveFileMarker {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub risk_level: String, // "low", "medium", "high"
    pub detected_patterns: Vec<String>,
    pub mime_type: Option<String>,
}

pub struct ContentScanner {
    // Regex patterns for sensitive content
    ssn_pattern: Regex,                    // XXX-XX-XXXX or XXXXXXXXX
    credit_card_pattern: Regex,            // 1234 5678 9012 3456 or 1234567890123456
    iban_pattern: Regex,                   // International Bank Account Number
    passport_pattern: Regex,               // Passport format (varies)
    private_key_pattern: Regex,            // -----BEGIN PRIVATE KEY-----
    password_indicator_pattern: Regex,     // password\s*=|secret\s*=
}

impl Default for ContentScanner {
    fn default() -> Self {
        Self {
            ssn_pattern: Regex::new(r"(?:\d{3}-\d{2}-\d{4}|\d{9})").unwrap(),
            credit_card_pattern: Regex::new(
                r"(?:\d{4}[\s-]?){3}\d{4}|\d{16}",
            ).unwrap(),
            iban_pattern: Regex::new(
                r"[A-Z]{2}\d{2}[A-Z0-9]{1,30}",
            ).unwrap(),
            passport_pattern: Regex::new(
                r"[A-Z]{1,2}\d{6,9}",
            ).unwrap(),
            private_key_pattern: Regex::new(
                r"-----BEGIN (PRIVATE|RSA|DSA|OPENSSH|PGP) KEY",
            ).unwrap(),
            password_indicator_pattern: Regex::new(
                r"(?i)password\s*=|secret\s*=|api[_-]?key\s*=|token\s*=",
            ).unwrap(),
        }
    }
}

impl ContentScanner {
    pub fn new() -> Self {
        Self::default()
    }

    /// Scan a file for sensitive content
    pub fn scan_file(&self, path: &Path) -> Option<SensitiveFileMarker> {
        if !path.exists() {
            return None;
        }

        let file_size = fs::metadata(path).ok()?.len();
        let mime_type = self.guess_mime_type(path);

        // Check file type risk first
        let mut detected_patterns = Vec::new();
        let mut risk_level = "low";

        // Scan file extension for high-risk types
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                // Financial documents
                "pdf" | "xlsx" | "xls" | "csv" | "docx" | "doc" => {
                    if ext_str == "pdf" || ext_str == "xlsx" {
                        detected_patterns.push("financial_document".to_string());
                        risk_level = "high";
                    }
                }
                // Images (potential personal photos)
                "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => {
                    detected_patterns.push("image_file".to_string());
                    risk_level = "medium";
                }
                // Secrets/keys
                "pem" | "key" | "ppk" | "p12" | "pfx" => {
                    detected_patterns.push("key_file".to_string());
                    risk_level = "high";
                }
                // Config files often contain secrets
                ".env" | ".env.local" | "config.json" => {
                    detected_patterns.push("config_file".to_string());
                    risk_level = "high";
                }
                _ => {}
            }
        }

        // Only scan text files for content patterns to avoid huge binary scans
        if self.is_text_file(path) {
            if let Ok(contents) = fs::read_to_string(path) {
                if contents.len() > 1_000_000 {
                    // Skip scanning very large files
                    if risk_level == "low" {
                        return None;
                    } else {
                        // Return if already flagged by extension
                        return Some(SensitiveFileMarker {
                            file_path: path.to_string_lossy().to_string(),
                            file_name: path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string(),
                            file_size,
                            risk_level: risk_level.to_string(),
                            detected_patterns,
                            mime_type,
                        });
                    }
                }

                // Scan for patterns
                if self.ssn_pattern.is_match(&contents) {
                    detected_patterns.push("ssn_or_id_number".to_string());
                    risk_level = "high";
                }
                if self.credit_card_pattern.is_match(&contents) {
                    detected_patterns.push("credit_card_number".to_string());
                    risk_level = "high";
                }
                if self.iban_pattern.is_match(&contents) {
                    detected_patterns.push("bank_account_number".to_string());
                    risk_level = "high";
                }
                if self.private_key_pattern.is_match(&contents) {
                    detected_patterns.push("private_key".to_string());
                    risk_level = "high";
                }
                if self.password_indicator_pattern.is_match(&contents) {
                    detected_patterns.push("password_or_secret".to_string());
                    risk_level = "high";
                }
            }
        }

        if detected_patterns.is_empty() && risk_level == "low" {
            return None;
        }

        Some(SensitiveFileMarker {
            file_path: path.to_string_lossy().to_string(),
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            file_size,
            risk_level: risk_level.to_string(),
            detected_patterns,
            mime_type,
        })
    }

    fn is_text_file(&self, path: &Path) -> bool {
        match path.extension() {
            Some(ext) => {
                let ext_str = ext.to_string_lossy().to_lowercase();
                matches!(
                    ext_str.as_str(),
                    "txt" | "csv" | "json" | "xml" | "log" | "conf" | "config" | "env"
                        | "pem" | "key" | "pub" | "sh" | "py" | "rs" | "js" | "ts" | "java"
                        | "cpp" | "c" | "h" | "sql" | "yaml" | "yml" | "toml" | "ini"
                )
            }
            None => false,
        }
    }

    fn guess_mime_type(&self, path: &Path) -> Option<String> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| match ext.to_lowercase().as_str() {
                "pdf" => "application/pdf",
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "txt" => "text/plain",
                "json" => "application/json",
                "csv" => "text/csv",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                _ => "application/octet-stream",
            })
            .map(String::from)
    }
}

// Tauri command: Scan directory for sensitive files
#[tauri::command]
pub fn scan_directory_for_sensitive_files(
    directory_path: String,
) -> Result<Vec<SensitiveFileMarker>, String> {
    let path = std::path::Path::new(&directory_path);

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let scanner = ContentScanner::new();
    let mut results = Vec::new();

    // Scan only immediate children (non-recursive)
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();

        if file_path.is_file() {
            if let Some(marker) = scanner.scan_file(&file_path) {
                results.push(marker);
            }
        }
    }

    // Sort by risk level
    results.sort_by(|a, b| {
        let risk_order = |r: &str| match r {
            "high" => 0,
            "medium" => 1,
            _ => 2,
        };
        risk_order(&a.risk_level).cmp(&risk_order(&b.risk_level))
    });

    Ok(results)
}
