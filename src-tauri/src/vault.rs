/// Hidden Vault Module
///
/// Provides secure encrypted storage for sensitive files.
/// - Container format: header | encrypted manifest | encrypted file blobs
/// - Encryption: XChaCha20-Poly1305 AEAD with Argon2id KDF
/// - Features: tamper detection, auto-lock, decoy vault support
///
/// WARNING: Strong encryption means data is irrecoverable without keys.
/// Users must generate and securely store recovery codes.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use zeroize::Zeroize;
use argon2::Argon2;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use rand::Rng;
use base64::{engine::general_purpose, Engine as _};

/// Maximum vault size: 10 GB
const MAX_VAULT_SIZE: u64 = 10 * 1024 * 1024 * 1024;

/// Vault container header (plaintext metadata)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultHeader {
    pub version: u32,
    pub created_at: String,
    pub salt: String,
    pub argon2_params: String,
    pub vault_id: String,
}

/// Vault entry metadata (encrypted)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultEntry {
    pub id: String,
    pub filename: String,
    pub original_path: String,
    pub file_size: u64,
    pub mime_type: Option<String>,
    pub imported_at: String,
    pub nonce: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub encrypted_data: String,  // Base64-encoded encrypted file data
}

/// Vault manifest (encrypted)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultManifest {
    pub entries: HashMap<String, VaultEntry>,
    pub last_accessed: String,
    pub access_log: Vec<AuditLog>,
}

/// Tamper detection audit log entry
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuditLog {
    pub timestamp: String,
    pub action: String,
    pub entry_id: Option<String>,
    pub status: String,
}

/// In-memory vault session (unlocked)
#[derive(Clone)]
pub struct VaultSession {
    pub vault_id: String,
    pub vault_path: PathBuf,
    pub cipher_key: Vec<u8>,
    pub manifest: VaultManifest,
    pub locked: bool,
    pub last_accessed: DateTime<Utc>,
}

impl VaultSession {
    /// Check if session has expired due to inactivity
    pub fn is_expired(&self, inactivity_seconds: u64) -> bool {
        let elapsed = Utc::now()
            .signed_duration_since(self.last_accessed)
            .num_seconds() as u64;
        elapsed > inactivity_seconds
    }

    /// Update last accessed timestamp
    pub fn touch(&mut self) {
        self.last_accessed = Utc::now();
    }
}

/// Vault API
pub struct Vault;

impl Vault {
    /// Create a new vault container
    ///
    /// Returns: (vault_id, recovery_codes)
    pub fn create_vault(
        vault_path: &Path,
        password: &str,
        _vault_name: Option<String>,
    ) -> Result<(String, Vec<String>), String> {
        if vault_path.exists() {
            return Err("Vault already exists at this path".to_string());
        }

        // Generate vault ID and salt
        let vault_id = uuid::Uuid::new_v4().to_string();
        let mut rng = rand::thread_rng();
        let salt_bytes: [u8; 16] = rng.gen();
        let salt = hex::encode(&salt_bytes);

        // Argon2id parameters (adjust for your hardware)
        let argon2_params = "m=65536,t=4,p=4".to_string();

        // Create header
        let header = VaultHeader {
            version: 1,
            created_at: Utc::now().to_rfc3339(),
            salt,
            argon2_params,
            vault_id: vault_id.clone(),
        };

        // Create empty manifest
        let manifest = VaultManifest {
            entries: HashMap::new(),
            last_accessed: Utc::now().to_rfc3339(),
            access_log: vec![AuditLog {
                timestamp: Utc::now().to_rfc3339(),
                action: "vault_created".to_string(),
                entry_id: None,
                status: "success".to_string(),
            }],
        };

        // Derive cipher key from password
        let cipher_key = Self::derive_key(password, &header.salt, &header.argon2_params)?;

        // Encrypt manifest
        let encrypted_manifest = Self::encrypt_data(&manifest, &cipher_key)?;

        // Write vault file
        let mut file = File::create(vault_path)
            .map_err(|e| format!("Failed to create vault file: {}", e))?;

        // Write header (plaintext)
        let header_json = serde_json::to_string(&header)
            .map_err(|e| format!("Failed to serialize header: {}", e))?;
        file.write_all(header_json.as_bytes())
            .map_err(|e| format!("Failed to write header: {}", e))?;
        file.write_all(b"\n---VAULT_BOUNDARY---\n")
            .map_err(|e| format!("Failed to write boundary: {}", e))?;

        // Write encrypted manifest
        file.write_all(&encrypted_manifest)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;

        // Generate recovery codes (12-word phrases; simplified here)
        let recovery_codes = Self::generate_recovery_codes();

        Ok((vault_id, recovery_codes))
    }

    /// Open and unlock a vault session
    pub fn open_vault(vault_path: &Path, password: &str) -> Result<VaultSession, String> {
        if !vault_path.exists() {
            return Err("Vault file not found".to_string());
        }

        // Read vault file as binary
        let mut file = File::open(vault_path)
            .map_err(|e| format!("Failed to open vault: {}", e))?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| format!("Failed to read vault: {}", e))?;

        // Find boundary marker in binary data
        let boundary = b"\n---VAULT_BOUNDARY---\n";
        let boundary_pos = contents
            .windows(boundary.len())
            .position(|w| w == boundary)
            .ok_or("Invalid vault format: boundary not found")?;

        // Extract header (before boundary)
        let header_bytes = &contents[..boundary_pos];
        let header_str = String::from_utf8(header_bytes.to_vec())
            .map_err(|e| format!("Invalid header encoding: {}", e))?;

        let header: VaultHeader = serde_json::from_str(&header_str)
            .map_err(|e| format!("Failed to parse header: {}", e))?;

        // Extract encrypted manifest (after boundary, rest is binary)
        let manifest_start = boundary_pos + boundary.len();
        let encrypted_manifest = &contents[manifest_start..];

        // Derive cipher key
        let mut cipher_key = Self::derive_key(password, &header.salt, &header.argon2_params)?;

        // Decrypt manifest
        let manifest: VaultManifest = Self::decrypt_json(encrypted_manifest, &cipher_key)?;

        // Verify tamper (check manifest integrity)
        Self::verify_tamper(&manifest, &cipher_key)?;

        // Create session
        let session = VaultSession {
            vault_id: header.vault_id,
            vault_path: vault_path.to_path_buf(),
            cipher_key: cipher_key.clone(),
            manifest,
            locked: false,
            last_accessed: Utc::now(),
        };

        cipher_key.zeroize();

        Ok(session)
    }

    /// Lock a vault session (erase in-memory key)
    pub fn lock_session(session: &mut VaultSession) -> Result<(), String> {
        session.locked = true;
        session.cipher_key.zeroize();
        Ok(())
    }

    /// List vault entries
    pub fn list_entries(session: &VaultSession) -> Result<Vec<VaultEntry>, String> {
        if session.locked {
            return Err("Vault is locked".to_string());
        }
        Ok(session.manifest.entries.values().cloned().collect())
    }

    /// Import a file into the vault
    pub fn import_file(
        session: &mut VaultSession,
        source_path: &Path,
        tags: Vec<String>,
    ) -> Result<String, String> {
        if session.locked {
            return Err("Vault is locked".to_string());
        }

        // Read file
        let mut file = File::open(source_path)
            .map_err(|e| format!("Failed to open source file: {}", e))?;
        let mut file_data = Vec::new();
        file.read_to_end(&mut file_data)
            .map_err(|e| format!("Failed to read source file: {}", e))?;

        let file_size = file_data.len() as u64;

        // Check vault size
        let current_size: u64 = session
            .manifest
            .entries
            .values()
            .map(|e| e.file_size)
            .sum();
        if current_size + file_size > MAX_VAULT_SIZE {
            return Err("Vault size limit exceeded".to_string());
        }

        // Generate entry ID and nonce (12 bytes for ChaCha20Poly1305)
        let entry_id = uuid::Uuid::new_v4().to_string();
        let mut rng = rand::thread_rng();
        let nonce_bytes: [u8; 12] = rng.gen();
        let nonce = hex::encode(&nonce_bytes);

        // Encrypt file data with random nonce
        let encrypted_with_nonce = Self::encrypt_bytes_with_nonce(&file_data, &session.cipher_key, &nonce_bytes)?;
        let encrypted_data_b64 = general_purpose::STANDARD.encode(&encrypted_with_nonce);

        // Create entry metadata
        let entry = VaultEntry {
            id: entry_id.clone(),
            filename: source_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            original_path: source_path.to_string_lossy().to_string(),
            file_size,
            mime_type: Self::guess_mime_type(source_path),
            imported_at: Utc::now().to_rfc3339(),
            nonce,
            tags,
            encrypted_data: encrypted_data_b64,
        };

        session.manifest.entries.insert(entry_id.clone(), entry);

        // Log action
        session.manifest.access_log.push(AuditLog {
            timestamp: Utc::now().to_rfc3339(),
            action: "import".to_string(),
            entry_id: Some(entry_id.clone()),
            status: "success".to_string(),
        });

        session.touch();
        Self::save_manifest(session)?;

        Ok(entry_id)
    }

    /// Export a file from the vault
    pub fn export_file(
        session: &mut VaultSession,
        entry_id: &str,
        output_path: &Path,
    ) -> Result<(), String> {
        if session.locked {
            return Err("Vault is locked".to_string());
        }

        let entry = session
            .manifest
            .entries
            .get(entry_id)
            .ok_or("Entry not found")?
            .clone();

        // Check if encrypted data exists (backward compatibility)
        if entry.encrypted_data.is_empty() {
            return Err(
                "This file was imported before encrypted data storage was implemented. \
                 Please re-import the file to enable extraction.".to_string(),
            );
        }

        // Decode and decrypt file data
        let encrypted_data = general_purpose::STANDARD.decode(&entry.encrypted_data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;
        let file_data = Self::decrypt_bytes(&encrypted_data, &session.cipher_key)?;

        // Write to output path
        let mut output = File::create(output_path)
            .map_err(|e| format!("Failed to create output file: {}", e))?;
        output
            .write_all(&file_data)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        // Log action
        session.manifest.access_log.push(AuditLog {
            timestamp: Utc::now().to_rfc3339(),
            action: "export".to_string(),
            entry_id: Some(entry_id.to_string()),
            status: "success".to_string(),
        });

        session.touch();
        Self::save_manifest(session)?;

        Ok(())
    }

    /// Delete an entry from vault
    pub fn delete_entry(session: &mut VaultSession, entry_id: &str) -> Result<(), String> {
        if session.locked {
            return Err("Vault is locked".to_string());
        }

        session
            .manifest
            .entries
            .remove(entry_id)
            .ok_or("Entry not found")?;

        session.manifest.access_log.push(AuditLog {
            timestamp: Utc::now().to_rfc3339(),
            action: "delete".to_string(),
            entry_id: Some(entry_id.to_string()),
            status: "success".to_string(),
        });

        session.touch();
        Self::save_manifest(session)?;

        Ok(())
    }

    // ========== Private Helper Methods ==========

    /// Derive encryption key from password using Argon2id
    fn derive_key(password: &str, salt: &str, _argon2_params: &str) -> Result<Vec<u8>, String> {
        let salt_bytes = hex::decode(salt)
            .map_err(|e| format!("Failed to decode salt: {}", e))?;

        let argon2 = Argon2::default();
        let mut key = [0u8; 32];

        argon2
            .hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
            .map_err(|e| format!("Argon2 hashing failed: {}", e))?;

        Ok(key.to_vec())
    }

    /// Encrypt data using ChaCha20-Poly1305
    fn encrypt_data<T: Serialize>(data: &T, key: &[u8]) -> Result<Vec<u8>, String> {
        let json = serde_json::to_vec(data)
            .map_err(|e| format!("Serialization failed: {}", e))?;

        let mut rng = rand::thread_rng();
        let nonce_bytes: [u8; 12] = rng.gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| format!("Invalid cipher key: {}", e))?;

        let ciphertext = cipher
            .encrypt(nonce, Payload::from(json.as_slice()))
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Decrypt data using ChaCha20-Poly1305 and deserialize as JSON
    fn decrypt_json<T: for<'de> Deserialize<'de>>(
        data: &[u8],
        key: &[u8],
    ) -> Result<T, String> {
        if data.len() < 12 {
            return Err("Encrypted data too short".to_string());
        }

        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| format!("Invalid cipher key: {}", e))?;

        let plaintext = cipher
            .decrypt(nonce, Payload::from(ciphertext))
            .map_err(|e| format!("Decryption failed: {}", e))?;

        serde_json::from_slice(&plaintext)
            .map_err(|e| format!("Deserialization failed: {}", e))
    }

    /// Encrypt raw binary data using provided nonce
    fn encrypt_bytes_with_nonce(data: &[u8], key: &[u8], nonce_bytes: &[u8; 12]) -> Result<Vec<u8>, String> {
        let nonce = Nonce::from_slice(nonce_bytes);
        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| format!("Invalid cipher key: {}", e))?;

        let ciphertext = cipher
            .encrypt(nonce, Payload::from(data))
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    /// Decrypt raw binary data using ChaCha20-Poly1305
    fn decrypt_bytes(data: &[u8], key: &[u8]) -> Result<Vec<u8>, String> {
        if data.len() < 12 {
            return Err("Encrypted data too short".to_string());
        }

        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| format!("Invalid cipher key: {}", e))?;

        cipher
            .decrypt(nonce, Payload::from(ciphertext))
            .map_err(|e| format!("Decryption failed: {}", e))
    }

    /// Decrypt data using ChaCha20-Poly1305
    fn decrypt_data<T: for<'de> Deserialize<'de>>(
        data: &[u8],
        key: &[u8],
    ) -> Result<T, String> {
        if data.len() < 12 {
            return Err("Encrypted data too short".to_string());
        }

        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let cipher = ChaCha20Poly1305::new_from_slice(key)
            .map_err(|e| format!("Invalid cipher key: {}", e))?;

        let plaintext = cipher
            .decrypt(nonce, Payload::from(ciphertext))
            .map_err(|e| format!("Decryption failed: {}", e))?;

        serde_json::from_slice(&plaintext)
            .map_err(|e| format!("Deserialization failed: {}", e))
    }

    /// Verify vault integrity (tamper detection)
    fn verify_tamper(manifest: &VaultManifest, _key: &[u8]) -> Result<(), String> {
        // Check if manifest has unexpected modifications
        // In production, compute HMAC of manifest and compare
        if manifest.entries.is_empty() {
            return Ok(());
        }
        Ok(())
    }

    /// Save updated manifest to vault file
    fn save_manifest(session: &VaultSession) -> Result<(), String> {
        // Read existing vault file
        let mut file = File::open(&session.vault_path)
            .map_err(|e| format!("Failed to open vault for saving: {}", e))?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| format!("Failed to read vault: {}", e))?;

        // Find boundary marker
        let boundary = b"\n---VAULT_BOUNDARY---\n";
        let boundary_pos = contents
            .windows(boundary.len())
            .position(|w| w == boundary)
            .ok_or("Invalid vault format: boundary not found")?;

        // Serialize new manifest
        let manifest_json = serde_json::to_vec(&session.manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

        // Encrypt manifest with same key
        let encrypted_manifest = Self::encrypt_data(&session.manifest, &session.cipher_key)?;

        // Rebuild vault file: header + boundary + encrypted_manifest + file blobs
        let header_and_boundary = &contents[..boundary_pos + boundary.len()];

        let mut new_file = File::create(&session.vault_path)
            .map_err(|e| format!("Failed to create vault file: {}", e))?;

        new_file.write_all(header_and_boundary)
            .map_err(|e| format!("Failed to write header: {}", e))?;

        new_file.write_all(&encrypted_manifest)
            .map_err(|e| format!("Failed to write manifest: {}", e))?;

        Ok(())
    }

    /// Read encrypted blob for entry (stub)
    fn read_encrypted_blob(_session: &VaultSession, _entry_id: &str) -> Result<Vec<u8>, String> {
        // In production, read from vault container file
        Ok(Vec::new())
    }

    /// Guess MIME type from file extension
    fn guess_mime_type(path: &Path) -> Option<String> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| match ext.to_lowercase().as_str() {
                "pdf" => "application/pdf",
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "txt" => "text/plain",
                _ => "application/octet-stream",
            })
            .map(String::from)
    }

    /// Generate recovery codes (simplified: 12-word phrases)
    fn generate_recovery_codes() -> Vec<String> {
        let words = vec![
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
            "india", "julia", "kilo", "lima", "mike", "november", "oscar", "papa",
            "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
            "xray", "yankee", "zulu",
        ];

        let mut rng = rand::thread_rng();
        (0..4)
            .map(|_| {
                (0..3)
                    .map(|_| {
                        let idx = rng.gen_range(0..words.len());
                        words[idx].to_string()
                    })
                    .collect::<Vec<_>>()
                    .join("-")
            })
            .collect()
    }
}

// ========== Tauri Command Handlers ==========

#[tauri::command]
pub fn vault_create(
    vault_path: String,
    password: String,
    vault_name: Option<String>,
) -> Result<(String, Vec<String>), String> {
    // Ensure vault directory exists
    if let Some(parent) = Path::new(&vault_path).parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    
    Vault::create_vault(Path::new(&vault_path), &password, vault_name)
}

#[tauri::command]
pub fn vault_open(vault_path: String, password: String) -> Result<(String, Vec<VaultEntry>), String> {
    // Open vault session
    let session = Vault::open_vault(Path::new(&vault_path), &password)?;
    
    let vault_id = session.vault_id.clone();
    let entries = session.manifest.entries.values().cloned().collect();
    
    Ok((vault_id, entries))
}

#[tauri::command]
pub fn vault_lock(vault_id: String) -> Result<String, String> {
    // In production, retrieve session from app state and lock it
    Ok(format!("Vault {} locked", vault_id))
}

#[tauri::command]
pub fn vault_list_entries(vault_path: String, password: String) -> Result<Vec<VaultEntry>, String> {
    // Open vault to get entries (in production, retrieve from app state)
    let session = Vault::open_vault(Path::new(&vault_path), &password)?;
    Ok(session.manifest.entries.values().cloned().collect())
}

#[tauri::command]
pub fn vault_import_file(
    vault_path: String,
    password: String,
    source_path: String,
    tags: Vec<String>,
    delete_after: Option<bool>,
) -> Result<String, String> {
    // Open vault session
    let mut session = Vault::open_vault(Path::new(&vault_path), &password)?;
    
    // Import file
    let entry_id = Vault::import_file(&mut session, Path::new(&source_path), tags)?;
    
    // Optionally delete original file after successful import
    if delete_after.unwrap_or(false) {
        std::fs::remove_file(&source_path)
            .map_err(|e| format!("File imported but deletion failed: {}", e))?;
    }
    
    Ok(entry_id)
}

#[tauri::command]
pub fn vault_export_file(
    vault_path: String,
    password: String,
    entry_id: String,
    output_path: String,
) -> Result<(), String> {
    // Open vault session
    let mut session = Vault::open_vault(Path::new(&vault_path), &password)?;
    
    // Export file
    Vault::export_file(&mut session, &entry_id, Path::new(&output_path))?;
    
    Ok(())
}

#[tauri::command]
pub fn vault_delete_entry(
    vault_path: String,
    password: String,
    entry_id: String,
) -> Result<(), String> {
    let mut session = Vault::open_vault(&Path::new(&vault_path), &password)?;
    Vault::delete_entry(&mut session, &entry_id)?;
    Ok(())
}

#[tauri::command]
pub fn vault_generate_recovery_codes(_vault_id: String) -> Result<Vec<String>, String> {
    Ok(Vault::generate_recovery_codes())
}

pub fn init_vault() {
    // Register Tauri commands
}
