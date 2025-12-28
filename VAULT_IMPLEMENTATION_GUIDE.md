# Hidden Vault - Developer Implementation Guide

## Overview

This guide details implementation steps for features that are currently scaffolded but not fully implemented.

## Current Implementation Status

### ✅ Completed

- **Rust encryption module** (`vault.rs`): Core KDF, AEAD, command structure
- **Frontend UI** (`VaultModal.tsx`, `VaultTrigger.tsx`): 6-screen modal, trigger detection
- **Content scanner** (`content_scanner.rs`): Regex pattern matching, file analysis
- **Technical specification** (`VAULT_FORMAT_SPEC.md`): Detailed format and design

### 🟡 Partially Complete (Scaffolded)

- **File blob persistence**: Currently returns placeholder
- **Session state management**: Vault commands don't persist across requests
- **Auto-lock timer**: UI present, backend timer logic missing
- **Decoy vault**: Architecture specified, separate file not created

### ❌ Not Started

- **Shamir Secret Sharing**: Optional recovery code splitting
- **OS keystore integration**: Optional master key wrapping
- **OCR content analysis**: Image text recognition
- **Sync across devices**: Cloud vault backup (optional)

---

## 1. File Blob Persistence

### Current State

```rust
// In vault.rs - STUB
fn read_encrypted_blob(&self, position: u64) -> Result<Vec<u8>> {
    // Placeholder: read encrypted file data from vault container
    Ok(Vec::new())
}

fn save_manifest(&mut self) -> Result<()> {
    // Placeholder: write manifest back to vault file
    Ok(())
}
```

### What Needs Implementation

The vault container format is:
```
[Plaintext JSON Header (300-500 bytes)]
\n---VAULT_BOUNDARY---\n
[Encrypted Manifest (JSON, ~1-10 KB)]
[Encrypted File Blob 1]
[Encrypted File Blob 2]
...
[Encrypted File Blob N]
```

Each blob entry in manifest contains:
```json
{
  "file_id": "uuid-string",
  "original_path": "/path/to/file",
  "original_name": "filename.ext",
  "size": 1048576,
  "mime_type": "application/pdf",
  "nonce": "hex-encoded-24-byte-nonce",
  "ciphertext_hash": "sha256-hash-for-tamper-detection",
  "blob_position": 2048,
  "blob_encrypted_size": 1048613,
  "created_at": "2025-01-15T10:30:00Z",
  "accessed_at": "2025-01-15T10:30:00Z"
}
```

### Implementation Steps

#### Step 1: Extend VaultSession Struct

Add blob tracking to the session:

```rust
pub struct VaultSession {
    pub vault_id: String,
    pub cipher: XChaCha20Poly1305,
    pub manifest: VaultManifest,
    pub vault_path: PathBuf,      // Path to vault file on disk
    pub unlocked_at: SystemTime,
    pub last_accessed: SystemTime,
    pub is_locked: bool,
}
```

#### Step 2: Implement read_encrypted_blob()

```rust
fn read_encrypted_blob(&self, blob_position: u64, blob_size: u64) -> Result<Vec<u8>> {
    use std::io::{Seek, Read};
    use std::fs::File;
    
    let mut file = File::open(&self.vault_path)?;
    file.seek(std::io::SeekFrom::Start(blob_position))?;
    
    let mut buffer = vec![0u8; blob_size as usize];
    file.read_exact(&mut buffer)?;
    
    Ok(buffer)
}

fn decrypt_blob(&self, encrypted_blob: &[u8], nonce_hex: &str) -> Result<Vec<u8>> {
    let nonce = hex::decode(nonce_hex)?;
    let nonce = XChaCha20Poly1305::nonce_size();
    let nonce = XChaCha20Poly1305::Nonce::from_slice(&nonce);
    
    self.cipher.decrypt(nonce, encrypted_blob.as_ref())
        .map_err(|e| VaultError::DecryptionFailed(e.to_string()).into())
}
```

#### Step 3: Implement save_manifest()

```rust
fn save_manifest(&mut self) -> Result<()> {
    use std::io::{Seek, Write};
    use std::fs::File;
    
    let manifest_json = serde_json::to_vec(&self.manifest)?;
    
    // Generate random nonce for manifest encryption
    let mut nonce_bytes = [0u8; 24];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = XChaCha20Poly1305::Nonce::from_slice(&nonce_bytes);
    
    // Encrypt manifest
    let encrypted_manifest = self.cipher
        .encrypt(nonce, manifest_json.as_ref())
        .map_err(|e| VaultError::EncryptionFailed(e.to_string()))?;
    
    // Find vault boundary position
    let mut file = File::open(&self.vault_path)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)?;
    
    let boundary = b"\n---VAULT_BOUNDARY---\n";
    let boundary_pos = contents.windows(boundary.len())
        .position(|w| w == boundary)
        .ok_or(VaultError::CorruptedVault)?;
    
    let manifest_start = boundary_pos + boundary.len();
    
    // Find where file blobs start (if any exist)
    // For now, write manifest at fixed position after boundary
    
    let mut file = File::create(&self.vault_path)?;
    file.write_all(&contents[..manifest_start])?;
    file.write_all(&encrypted_manifest)?;
    
    // Write all blob offsets...
    // (This is simplified; real implementation tracks positions)
    
    Ok(())
}
```

#### Step 4: Update import_file() to actually store blob

```rust
pub fn import_file(&mut self, file_path: &str, vault_name: &str) -> Result<String> {
    use std::fs::File;
    use std::io::Read;
    
    let path = PathBuf::from(file_path);
    let mut file = File::open(&path)?;
    
    // Read file data
    let mut file_data = Vec::new();
    file.read_to_end(&mut file_data)?;
    
    // Generate nonce and encrypt
    let mut nonce_bytes = [0u8; 24];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce_hex = hex::encode(&nonce_bytes);
    let nonce = XChaCha20Poly1305::Nonce::from_slice(&nonce_bytes);
    
    let encrypted_blob = self.cipher
        .encrypt(nonce, file_data.as_ref())
        .map_err(|e| VaultError::EncryptionFailed(e.to_string()))?;
    
    // Calculate tamper detection hash
    let ciphertext_hash = {
        use sha2::Sha256;
        use sha2::Digest;
        let mut hasher = Sha256::new();
        hasher.update(&encrypted_blob);
        hex::encode(hasher.finalize())
    };
    
    // Append blob to vault file
    let blob_position = self.append_blob(&encrypted_blob)?;
    
    // Add entry to manifest
    let entry = VaultEntry {
        file_id: uuid::Uuid::new_v4().to_string(),
        original_path: path.to_string_lossy().to_string(),
        original_name: path.file_name().unwrap().to_string_lossy().to_string(),
        size: file_data.len() as u64,
        mime_type: infer_mime_type(&path),
        nonce: nonce_hex,
        ciphertext_hash,
        blob_position,
        blob_encrypted_size: encrypted_blob.len() as u64,
        created_at: SystemTime::now(),
        accessed_at: SystemTime::now(),
    };
    
    self.manifest.entries.push(entry.clone());
    self.save_manifest()?;
    
    // Log audit event
    self.manifest.audit_log.push(AuditLogEntry {
        timestamp: SystemTime::now(),
        action: "import_file".to_string(),
        file_id: entry.file_id.clone(),
        details: format!("Imported {}", entry.original_name),
    });
    
    Ok(entry.file_id)
}

fn append_blob(&mut self, blob: &[u8]) -> Result<u64> {
    use std::fs::OpenOptions;
    use std::io::Write;
    
    let mut file = OpenOptions::new()
        .append(true)
        .open(&self.vault_path)?;
    
    // Get current position
    let position = file.seek(std::io::SeekFrom::End(0))?;
    
    // Write blob
    file.write_all(blob)?;
    
    Ok(position)
}
```

#### Step 5: Update export_file() to decrypt and return blob

```rust
pub fn export_file(&mut self, file_id: &str, output_path: &str) -> Result<()> {
    // Find entry in manifest
    let entry = self.manifest.entries
        .iter()
        .find(|e| e.file_id == file_id)
        .ok_or(VaultError::FileNotFound)?;
    
    // Read encrypted blob
    let encrypted_blob = self.read_encrypted_blob(
        entry.blob_position,
        entry.blob_encrypted_size,
    )?;
    
    // Verify tamper detection hash
    let actual_hash = {
        use sha2::Sha256;
        use sha2::Digest;
        let mut hasher = Sha256::new();
        hasher.update(&encrypted_blob);
        hex::encode(hasher.finalize())
    };
    
    if actual_hash != entry.ciphertext_hash {
        return Err(VaultError::TamperDetected.into());
    }
    
    // Decrypt blob
    let decrypted_data = self.decrypt_blob(&encrypted_blob, &entry.nonce)?;
    
    // Write to output path
    let mut file = std::fs::File::create(output_path)?;
    file.write_all(&decrypted_data)?;
    
    // Update manifest access time
    entry.accessed_at = SystemTime::now();
    self.save_manifest()?;
    
    // Log audit event
    self.manifest.audit_log.push(AuditLogEntry {
        timestamp: SystemTime::now(),
        action: "export_file".to_string(),
        file_id: file_id.to_string(),
        details: format!("Exported to {}", output_path),
    });
    
    Ok(())
}
```

### Testing Checklist

- [ ] Create vault → files appear in container
- [ ] Import 1 MB file → verify blob position and size in manifest
- [ ] Export file → contents match original
- [ ] Modify vault file 1 bit → tamper detection alerts
- [ ] Lock/unlock → manifest persists correctly
- [ ] Concurrent file ops → no race conditions
- [ ] Very large file (1 GB) → doesn't consume all RAM

---

## 2. Session State Management

### Current State

Vault commands are stateless stubs that return placeholders.

### What Needs Implementation

Create a session manager to track multiple unlocked vaults:

```rust
pub struct VaultSessionManager {
    sessions: Arc<Mutex<HashMap<String, VaultSession>>>,
}

impl VaultSessionManager {
    pub fn new() -> Self {
        VaultSessionManager {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub fn create_session(&self, vault_id: String, session: VaultSession) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(vault_id, session);
        Ok(())
    }
    
    pub fn get_session(&self, vault_id: &str) -> Result<VaultSession> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(vault_id)
            .cloned()
            .ok_or(VaultError::SessionNotFound)
    }
    
    pub fn list_sessions(&self) -> Result<Vec<String>> {
        let sessions = self.sessions.lock().unwrap();
        Ok(sessions.keys().cloned().collect())
    }
    
    pub fn lock_session(&self, vault_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(vault_id);
        Ok(())
    }
}
```

### Implementation Steps

#### Step 1: Add session manager to Tauri state

```rust
// In main.rs
pub struct AppState {
    vault_manager: Arc<VaultSessionManager>,
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            vault_manager: Arc::new(VaultSessionManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            vault_create,
            vault_open,
            vault_lock,
            vault_list_entries,
            vault_import_file,
            vault_export_file,
            vault_delete_entry,
            vault_generate_recovery_codes,
            scan_directory_for_sensitive_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
```

#### Step 2: Wire commands to session manager

```rust
#[tauri::command]
pub fn vault_open(
    state: tauri::State<'_, AppState>,
    vault_path: String,
    password: String,
) -> Result<(String, Vec<VaultEntry>), String> {
    let vault = Vault::open_vault(&vault_path, &password)
        .map_err(|e| e.to_string())?;
    
    let vault_id = vault.header.vault_id.clone();
    let entries = vault.manifest.entries.clone();
    
    // Store session in manager
    state.vault_manager
        .create_session(vault_id.clone(), vault)
        .map_err(|e| e.to_string())?;
    
    Ok((vault_id, entries))
}

#[tauri::command]
pub fn vault_list_entries(
    state: tauri::State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<VaultEntry>, String> {
    let vault = state.vault_manager
        .get_session(&vault_id)
        .map_err(|e| e.to_string())?;
    
    Ok(vault.manifest.entries.clone())
}

#[tauri::command]
pub fn vault_import_file(
    state: tauri::State<'_, AppState>,
    vault_id: String,
    file_path: String,
) -> Result<String, String> {
    let mut vault = state.vault_manager
        .get_session(&vault_id)
        .map_err(|e| e.to_string())?;
    
    let file_id = vault.import_file(&file_path, "main")
        .map_err(|e| e.to_string())?;
    
    // Update session with modified vault
    state.vault_manager
        .create_session(vault_id, vault)
        .map_err(|e| e.to_string())?;
    
    Ok(file_id)
}
```

### Testing Checklist

- [ ] Open vault → session stored
- [ ] List entries from session → correct
- [ ] Open same vault twice → two sessions
- [ ] Lock vault → session removed
- [ ] Session cleanup on app close → no memory leaks
- [ ] Multiple vaults concurrent → no cross-contamination

---

## 3. Auto-Lock Timer

### Current State

UI has "auto-lock after X minutes" setting, but timer logic is not implemented.

### What Needs Implementation

#### Step 1: Add timer task to VaultSession

```rust
pub struct VaultSession {
    pub vault_id: String,
    pub cipher: XChaCha20Poly1305,
    pub manifest: VaultManifest,
    pub vault_path: PathBuf,
    pub unlocked_at: SystemTime,
    pub last_accessed: SystemTime,
    pub is_locked: bool,
    pub auto_lock_minutes: u64,  // NEW
    pub lock_task: Option<tokio::task::JoinHandle<()>>,  // NEW
}
```

#### Step 2: Start timer on unlock

```rust
pub fn unlock_vault(
    state: tauri::State<'_, AppState>,
    vault_id: String,
    auto_lock_minutes: u64,
) {
    let vault_id_clone = vault_id.clone();
    let manager = state.vault_manager.clone();
    
    // Spawn background task
    let handle = tokio::spawn(async move {
        tokio::time::sleep(
            tokio::time::Duration::from_secs(auto_lock_minutes * 60)
        ).await;
        
        // Auto-lock
        let _ = manager.lock_session(&vault_id_clone);
    });
    
    // Store handle in session for cleanup
    let mut vault = state.vault_manager.get_session(&vault_id).unwrap();
    vault.lock_task = Some(handle);
    state.vault_manager.create_session(vault_id, vault).unwrap();
}
```

#### Step 3: Reset timer on access

```rust
pub fn vault_list_entries(
    state: tauri::State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<VaultEntry>, String> {
    let mut vault = state.vault_manager
        .get_session(&vault_id)
        .map_err(|e| e.to_string())?;
    
    vault.last_accessed = SystemTime::now();  // Reset timer
    
    let entries = vault.manifest.entries.clone();
    state.vault_manager
        .create_session(vault_id, vault)
        .map_err(|e| e.to_string())?;
    
    Ok(entries)
}
```

### Testing Checklist

- [ ] Set auto-lock to 1 minute → lock after 60 seconds
- [ ] Access vault → timer resets
- [ ] Lock manually before timer expires → cancel timer
- [ ] Switch tabs/unfocus app → don't interfere with timer
- [ ] Auto-lock session → new open required, no memory leaks

---

## 4. Decoy Vault Implementation

### Current State

Settings UI has "Enable Decoy Vault" toggle, but separate vault file not created.

### What Needs Implementation

Create parallel vault system with separate encryption key and file storage.

#### Step 1: Add decoy vault path configuration

```rust
pub struct VaultHeader {
    pub vault_version: String,
    pub vault_id: String,
    pub vault_type: VaultType,  // NEW: "main" or "decoy"
    pub salt: String,
    pub decoy_enabled: bool,
    pub decoy_path: Option<String>,  // Path to decoy vault file
    pub encryption_algorithm: String,
    pub key_derivation_function: String,
    pub created_at: String,
    pub modified_at: String,
}

pub enum VaultType {
    Main,
    Decoy,
}
```

#### Step 2: Create decoy vault file

```rust
pub fn create_decoy_vault(
    vault_dir: &str,
    decoy_password: &str,
) -> Result<Vault> {
    let vault_path = PathBuf::from(vault_dir).join("decoy.vault");
    
    let mut vault = Vault::create_vault(&vault_path, decoy_password)?;
    vault.header.vault_type = VaultType::Decoy;
    
    // Create empty decoy manifest (no files)
    vault.manifest = VaultManifest {
        entries: Vec::new(),
        audit_log: Vec::new(),
    };
    
    vault.save_manifest()?;
    
    Ok(vault)
}
```

#### Step 3: Add Tauri command for decoy vault

```rust
#[tauri::command]
pub fn vault_enable_decoy(
    state: tauri::State<'_, AppState>,
    vault_id: String,
    decoy_password: String,
) -> Result<(), String> {
    let mut vault = state.vault_manager
        .get_session(&vault_id)
        .map_err(|e| e.to_string())?;
    
    // Create decoy vault file
    let decoy_path = vault.vault_path
        .parent()
        .unwrap()
        .join("decoy.vault");
    
    let decoy_vault = Vault::create_vault(
        decoy_path.to_str().unwrap(),
        &decoy_password,
    ).map_err(|e| e.to_string())?;
    
    // Update main vault header
    vault.header.decoy_enabled = true;
    vault.header.decoy_path = Some(decoy_path.to_string_lossy().to_string());
    vault.save_manifest()?;
    
    // Store decoy session
    let decoy_id = decoy_vault.header.vault_id.clone();
    state.vault_manager
        .create_session(decoy_id, decoy_vault)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

### Testing Checklist

- [ ] Enable decoy vault → separate file created
- [ ] Unlock decoy with different password → works
- [ ] Main and decoy sessions coexist → both accessible
- [ ] Move files to decoy → don't appear in main
- [ ] Decoy password != main password → enforced
- [ ] Delete decoy vault → only decoy file removed

---

## 5. Shamir Secret Sharing (Optional)

### Current State

Not implemented; recovery codes are single-factor.

### Enhancement Idea

Allow splitting recovery codes across multiple people/devices using Shamir's Secret Sharing (3-of-5 threshold).

### Implementation Approach

Use `shamir` or `secret-sharing` crate:

```rust
use shamir::{split, combine};

pub fn split_recovery_codes(
    recovery_codes: Vec<String>,
    num_shares: usize,
    threshold: usize,
) -> Result<Vec<Vec<String>>> {
    // Convert codes to bytes
    let data = recovery_codes.join(",").into_bytes();
    
    // Split using Shamir's Secret Sharing
    let shares = split(data, threshold as u8, num_shares as u8)?;
    
    // Convert each share back to word codes
    let word_shares = shares.iter().map(|share| {
        // Convert bytes to words
        words_from_bytes(share)
    }).collect();
    
    Ok(word_shares)
}

pub fn recover_from_shares(shares: Vec<Vec<String>>) -> Result<Vec<String>> {
    // Convert shares back to bytes
    let byte_shares = shares.iter().map(|s| bytes_from_words(s)).collect();
    
    // Combine using Shamir's Secret Sharing
    let original = combine(&byte_shares)?;
    
    // Parse back to recovery codes
    let codes_str = String::from_utf8(original)?;
    let codes = codes_str.split(',').map(|s| s.to_string()).collect();
    
    Ok(codes)
}
```

### Testing Checklist

- [ ] Split 4 codes into 5 shares with 3-of-5 threshold
- [ ] Recover with any 3 shares → original codes
- [ ] Recover with 2 shares → fails
- [ ] Each share independently secure → doesn't leak information

---

## 6. Security Review Checklist

Before deploying to production, verify:

- [ ] **No plaintext passwords in logs** — check vault.rs, main.rs for debug logs
- [ ] **Crypto randomness** — ensure `rand::thread_rng()` for all nonces (not timestamp-based)
- [ ] **Timing attacks** — use constant-time comparison for authentication tags
- [ ] **Memory safety** — all secrets zeroed after use (via `zeroize` crate)
- [ ] **Dependency vulnerabilities** — run `cargo audit` before release
- [ ] **File descriptor leaks** — ensure all file handles closed properly
- [ ] **Panic safety** — no unwrap() in production code paths
- [ ] **Cross-platform paths** — use PathBuf, not hardcoded "/" or "\"
- [ ] **Permission bits** — vault files created with 0600 (owner only)
- [ ] **Temp file cleanup** — no plaintext copies left in /tmp
- [ ] **Session timeout** — auto-lock actually removes keys from memory
- [ ] **Recovery code entropy** — entropy of word list >= 128 bits
- [ ] **KDF hardness** — Argon2id parameters verified for 1-2 seconds derivation

---

## Performance Optimization Guidelines

### For Large Vault Files (100+ files)

1. **Streaming encryption**: Don't load entire manifest into memory
   ```rust
   // Instead of loading all files, use iterator pattern
   pub fn list_entries_paginated(&self, page: usize, page_size: usize) -> Vec<VaultEntry> {
       self.manifest.entries
           .iter()
           .skip(page * page_size)
           .take(page_size)
           .cloned()
           .collect()
   }
   ```

2. **Lazy decryption**: Don't decrypt entire vault on unlock, decrypt on access
   ```rust
   pub fn export_file(&mut self, file_id: &str, output_path: &str) -> Result<()> {
       // Only decrypt this specific file
       let encrypted_blob = self.read_encrypted_blob(position, size)?;
       let decrypted = self.decrypt_blob(&encrypted_blob, &nonce)?;
       // Write decrypted to output
   }
   ```

3. **Compression**: Compress before encryption to reduce storage
   ```rust
   use flate2::Compression;
   use flate2::write::GzEncoder;
   
   let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
   encoder.write_all(&file_data)?;
   let compressed = encoder.finish()?;
   let encrypted = encrypt(&compressed)?;
   ```

### For Fast UI Response

1. **Async operations**: Use tokio::spawn for long operations
2. **Progress callbacks**: Return progress updates during import/export
3. **Batch operations**: Allow importing multiple files at once
4. **Caching**: Cache manifest in memory during session

---

## Deployment Checklist

Before releasing:

1. [ ] All tests pass: `cargo test`, `pnpm test`
2. [ ] No clippy warnings: `cargo clippy -- -D warnings`
3. [ ] Security audit: `cargo audit`
4. [ ] User guide reviewed
5. [ ] Recovery mechanism tested end-to-end
6. [ ] Decoy vault tested for plausibility
7. [ ] Performance tested with 1 GB files
8. [ ] Mobile/tablet UI verified
9. [ ] Linux/macOS/Windows paths verified
10. [ ] Legal review completed (especially decoy feature)

---

## Future Enhancements

- [ ] **Hardware security key support**: Use YubiKey for 2FA
- [ ] **Biometric unlock**: TouchID/FaceID on supported platforms
- [ ] **Cloud backup**: Optional encrypted cloud sync
- [ ] **Mobile app**: iOS/Android native vault access
- [ ] **Web vault viewer**: Browser-based read-only access
- [ ] **Team vaults**: Shared encrypted storage for groups
- [ ] **Blockchain logging**: Immutable audit log
- [ ] **ML content analysis**: Deep learning for sensitive content detection

---

**Last Updated:** December 2025  
**Target Implementation Order:** 1 → 2 → 3 → 4 → 5 → 6
