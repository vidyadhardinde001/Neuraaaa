# Hidden Vault - Architecture & System Design

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     NeuraFile (Main App)                     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           React Frontend (src/)                       │   │
│  │                                                        │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │VaultTrigger │  │ VaultModal   │  │SensitiveFile│  │   │
│  │  │(invisible)  │→ │ (6 screens)  │→ │Suggestions  │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  │                          ↓                             │   │
│  │                   App.tsx (state)                      │   │
│  │                          ↓                             │   │
│  │              Tauri IPC (invoke_handler)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ IPC Bridge
┌─────────────────────────────────────────────────────────────┐
│             Tauri Backend (src-tauri/src/)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  main.rs (command handlers & registration)          │   │
│  │                          ↓                             │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │   AppState {                                   │  │   │
│  │  │     vault_manager: VaultSessionManager         │  │   │
│  │  │   }                                            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                          ↓                             │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ Vault Commands (Tauri handlers)                │ │   │
│  │  │ ├─ vault_create(path, password)                │ │   │
│  │  │ ├─ vault_open(path, password) → VaultSession   │ │   │
│  │  │ ├─ vault_list_entries(vault_id)                │ │   │
│  │  │ ├─ vault_import_file(vault_id, file_path)      │ │   │
│  │  │ ├─ vault_export_file(vault_id, file_id)        │ │   │
│  │  │ ├─ vault_lock(vault_id)                        │ │   │
│  │  │ └─ vault_delete_entry(vault_id, file_id)       │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                          ↓                             │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  vault.rs (Core Vault Logic)                   │ │   │
│  │  │  ├─ Vault {                                    │ │   │
│  │  │  │   header: VaultHeader                       │ │   │
│  │  │  │   manifest: VaultManifest                   │ │   │
│  │  │  │   cipher: XChaCha20Poly1305                 │ │   │
│  │  │  │ }                                           │ │   │
│  │  │  └─ Functions:                                 │ │   │
│  │  │    ├─ create_vault()  [generates salt]         │ │   │
│  │  │    ├─ open_vault()    [derives key]            │ │   │
│  │  │    ├─ derive_key()    [Argon2id KDF]          │ │   │
│  │  │    ├─ encrypt_data()  [ChaCha20Poly1305]      │ │   │
│  │  │    ├─ decrypt_json()  [AEAD + JSON]            │ │   │
│  │  │    ├─ import_file()   [encrypt & store blob]   │ │   │
│  │  │    ├─ export_file()   [decrypt & retrieve]     │ │   │
│  │  │    ├─ generate_recovery_codes()                │ │   │
│  │  │    └─ verify_tamper()  [hash check]            │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ content_scanner.rs (Sensitive File Detection)  │ │   │
│  │  │ ├─ scan_directory_for_sensitive_files()        │ │   │
│  │  │ ├─ ContentScanner {                            │ │   │
│  │  │ │   patterns: [Regex; 6]                       │ │   │
│  │  │ │   ├─ SSN pattern                             │ │   │
│  │  │ │   ├─ Credit card pattern                      │ │   │
│  │  │ │   ├─ IBAN pattern                             │ │   │
│  │  │ │   ├─ Passport pattern                         │ │   │
│  │  │ │   ├─ Private key pattern                      │ │   │
│  │  │ │   └─ Password indicator pattern               │ │   │
│  │  │ │ }                                             │ │   │
│  │  │ └─ Risk scoring: high/medium/low                │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ File I/O
┌─────────────────────────────────────────────────────────────┐
│               Encrypted File System                          │
│                                                               │
│  ~/.vault/main.vault (Binary Encrypted Container)           │
│  ├─ [Plaintext JSON Header]                                 │
│  ├─ [Boundary: \n---VAULT_BOUNDARY---\n]                   │
│  ├─ [Encrypted Manifest] (JSON, ChaCha20Poly1305)           │
│  └─ [Encrypted File Blobs]                                  │
│                                                               │
│  ~/.vault/decoy.vault (Optional, separate key)              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Vault Creation Flow

```
User Input
   ↓
VaultModal "Create" Screen
   ├─ Password: "MySecurePassword123!"
   ├─ Confirm: "MySecurePassword123!"
   └─ [Create Button]
   ↓
vault_create(path, password) Tauri Command
   ↓
Vault::create_vault()
   ├─ Generate 16-byte random salt
   ├─ Derive 32-byte key:
   │  └─ Argon2id(password, salt, m=65536, t=4, p=4)
   ├─ Create empty VaultManifest
   ├─ Create VaultHeader {
   │   vault_id: UUID
   │   salt: hex-encoded
   │   encryption_algorithm: "XChaCha20-Poly1305"
   │   ...
   │ }
   └─ Write vault file with header + boundary
   ↓
Generate Recovery Codes
   ├─ 4 groups of 3 words each
   ├─ Derived deterministically from salt + password hash
   └─ Never stored, shown only once
   ↓
Return (vault_id, recovery_codes) to Frontend
   ↓
VaultModal displays recovery codes
   ↓
User prints/saves recovery codes
```

### 2. File Import Flow

```
User: "Import file.pdf to vault"
   ↓
VaultModal or SensitiveFileSuggestions
   ├─ File: /path/to/file.pdf
   └─ [Import Button]
   ↓
vault_import_file(vault_id, file_path) Tauri Command
   ↓
VaultSessionManager::get_session(vault_id)
   ↓
Vault::import_file(file_path)
   ├─ Read file into memory: file_data (1MB)
   ├─ Generate random 24-byte nonce
   ├─ Encrypt file_data:
   │  └─ XChaCha20Poly1305(key, nonce, file_data)
   │     → (ciphertext, auth_tag)
   ├─ Append ciphertext+tag to vault file
   ├─ Record blob position and size
   ├─ Create VaultEntry {
   │   file_id: UUID
   │   original_path: "/path/to/file.pdf"
   │   size: 1048576
   │   mime_type: "application/pdf"
   │   nonce: "hex-encoded-24-bytes"
   │   ciphertext_hash: SHA256(ciphertext)
   │   blob_position: 2048
   │   blob_encrypted_size: 1048613
   │   ...
   │ }
   ├─ Append entry to manifest.entries
   ├─ Encrypt and save manifest to vault file
   └─ Log audit event: "import_file"
   ↓
Return file_id to Frontend
   ↓
Frontend shows: "File imported successfully"
   ↓
Original file optionally deleted by user
```

### 3. File Export Flow

```
User: "Extract file from vault"
   ↓
VaultModal Manager Screen
   ├─ List: [file1.pdf, file2.docx, ...]
   └─ Click "Extract" on file1.pdf
   ↓
vault_export_file(vault_id, file_id, output_path)
   ↓
VaultSessionManager::get_session(vault_id)
   ↓
Vault::export_file(file_id, output_path)
   ├─ Find VaultEntry by file_id in manifest
   ├─ Read encrypted blob from vault file:
   │  └─ read_encrypted_blob(blob_position, blob_size)
   ├─ Verify tamper detection:
   │  └─ SHA256(ciphertext) == entry.ciphertext_hash
   ├─ Decrypt blob:
   │  └─ XChaCha20Poly1305_decrypt(key, nonce, ciphertext)
   │     → plaintext file data
   ├─ Write plaintext to output_path
   ├─ Update entry.accessed_at timestamp
   ├─ Save manifest with updated timestamp
   └─ Log audit event: "export_file"
   ↓
Return file written notification
   ↓
User downloads decrypted file from path
```

### 4. Sensitive File Detection Flow

```
User navigates to ~/Documents
   ↓
DirectoryContents Component loads
   ↓
React useEffect() triggers on mount/change
   ↓
scan_directory_for_sensitive_files(directory_path)
   ↓
ContentScanner::scan_directory()
   ├─ For each file in directory:
   │  ├─ Skip if .git, node_modules, etc
   │  └─ scan_file(file_path)
   │     ├─ Check file extension (PDF, XLSX, JPG = high risk)
   │     ├─ Read file content (first 100KB for large files)
   │     ├─ Run regex patterns:
   │     │  ├─ SSN: /\d{3}-\d{2}-\d{4}/
   │     │  ├─ Credit card: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/
   │     │  ├─ IBAN: /[A-Z]{2}\d{2} ?\d{4} ?\d{4}/
   │     │  ├─ Passport: /[A-Z]{1,2}\d{6,9}/
   │     │  ├─ Private key: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/
   │     │  └─ Password: /password|pwd|secret|apikey/i
   │     ├─ Return SensitiveFileMarker if matched:
   │     │  {
   │     │    path: "/path/to/file",
   │     │    risk_level: "high|medium|low",
   │     │    patterns_detected: ["SSN", "credit_card"],
   │     │    mime_type: "application/pdf",
   │     │  }
   │     └─ Else return None
   │
   └─ Sort results by risk_level (high first)
   ↓
Return Vec<SensitiveFileMarker>
   ↓
Frontend renders SensitiveFileSuggestions Component
   ├─ For each marker:
   │  ├─ Card with file name, risk badge, patterns found
   │  └─ Buttons: "Move to Vault", "Dismiss", "Details"
   └─ User clicks "Move to Vault" for each
   ↓
vault_import_file() called for each selected file
```

### 5. Password Recovery Flow

```
User: "I forgot my password"
   ↓
VaultModal "Menu" Screen
   ├─ Options: Create, Unlock, Forgot Password
   └─ Click "Forgot Password"
   ↓
VaultModal "Recovery" Screen
   ├─ Prompt: "Enter one of your recovery codes"
   └─ Input: "alpha bravo charlie"
   ↓
vault_recover_password(vault_path, recovery_code)
   ↓
Vault::verify_recovery_code(recovery_code)
   ├─ Read VaultHeader from vault file (plaintext)
   ├─ Extract salt from header
   ├─ Derive recovery code from salt + master hash
   │  └─ (Deterministic, not stored)
   ├─ Compare input recovery_code with derived
   └─ If match: allow password reset
   ↓
User enters new password
   ↓
Vault::open_vault(vault_path, "") → empty password allowed with recovery code
   ├─ Derive OLD key using empty password and salt
   ├─ Decrypt manifest with old key
   ├─ Generate NEW salt
   ├─ Derive NEW key from new password + new salt
   ├─ Re-encrypt manifest with new key
   └─ Save updated header with new salt
   ↓
New recovery codes generated
   ↓
Frontend displays new recovery codes
   ↓
User saves new codes and sets new password
```

## Component Hierarchy

```
App.tsx (Redux store, theme)
├─ VaultTrigger.tsx
│  └─ (invisible, event listeners)
│     └─ onTrigger() → open VaultModal
│
├─ VaultModal.tsx (conditional render if isOpen)
│  ├─ State: currentScreen (menu, create, unlock, manager, settings, recovery)
│  │
│  ├─ Screen 1: Menu
│  │  └─ Buttons: Create, Unlock, Settings
│  │
│  ├─ Screen 2: Create
│  │  ├─ Input: password (12+ chars)
│  │  ├─ Input: confirm password
│  │  └─ Button: Create
│  │
│  ├─ Screen 3: Unlock
│  │  ├─ Input: password
│  │  └─ Button: Unlock
│  │
│  ├─ Screen 4: Manager
│  │  ├─ List: vault entries (file_id, name, size, date)
│  │  ├─ Buttons per entry: Extract, Delete
│  │  └─ Button: Lock Vault
│  │
│  ├─ Screen 5: Settings
│  │  ├─ Slider: auto-lock minutes (1-60)
│  │  ├─ Checkbox: Enable Decoy Vault
│  │  ├─ Button: Change Password
│  │  ├─ Button: Regenerate Recovery Codes
│  │  └─ Button: Back
│  │
│  └─ Screen 6: Recovery
│     ├─ Display: recovery codes (4 groups, 3 words)
│     ├─ Button: Copy to Clipboard
│     └─ Button: Print
│
└─ SensitiveFileSuggestions.tsx (if sensitive files detected)
   ├─ For each SensitiveFileMarker:
   │  ├─ Card with expandable details
   │  ├─ Risk badge (red/yellow/blue)
   │  ├─ Patterns detected (SSN, credit card, etc)
   │  ├─ Button: Move to Vault
   │  └─ Button: Dismiss
   │
   └─ Dismissed files tracked in localStorage
```

## File Structure

### Vault File Layout

```
Byte 0-499:     JSON VaultHeader (plaintext)
                {
                  "vault_version": "1.0",
                  "vault_id": "550e8400-e29b-41d4-a716-446655440000",
                  "vault_type": "main",
                  "salt": "abcd1234...ef5678...",
                  "decoy_enabled": false,
                  "encryption_algorithm": "XChaCha20-Poly1305",
                  "key_derivation_function": "Argon2id",
                  "created_at": "2025-01-15T10:30:00Z"
                }

Byte 500-523:   Boundary Marker (plaintext)
                "\n---VAULT_BOUNDARY---\n"

Byte 524-XXX:   Encrypted Manifest (ChaCha20Poly1305)
                {
                  "entries": [
                    {
                      "file_id": "uuid1",
                      "original_name": "file1.pdf",
                      "size": 1048576,
                      "blob_position": 2048,
                      "blob_encrypted_size": 1048613,
                      "nonce": "hex-encoded-24-bytes",
                      "ciphertext_hash": "sha256-hash"
                    },
                    ...
                  ],
                  "audit_log": [
                    {
                      "timestamp": "2025-01-15T10:35:00Z",
                      "action": "import_file",
                      "file_id": "uuid1",
                      "details": "Imported file1.pdf"
                    },
                    ...
                  ]
                }

Byte XXX-YYY:   Encrypted File Blob 1
                (binary, XChaCha20Poly1305 ciphertext + tag)

Byte YYY-ZZZ:   Encrypted File Blob 2
                (binary, XChaCha20Poly1305 ciphertext + tag)

...             More blobs as added
```

## Encryption Schemes

### Key Derivation (Argon2id)

```
Input:  password (user-provided string)
        salt (16 random bytes from vault header)

Process:
    key = Argon2id(
        password_bytes,
        salt,
        memory_cost = 65536 KB,
        iterations = 4,
        parallelism = 4,
        output_length = 32 bytes,
        variant = "Argon2id"
    )

Output: 32-byte encryption key
        
Timing: ~1-2 seconds on modern hardware
        (deters brute-force)
```

### Manifest Encryption (AEAD)

```
Key:     32-byte key (from Argon2id above)
Nonce:   24 random bytes (XChaCha20 requires 24-byte nonce)
AAD:     (optional) "manifest" string for domain separation
Data:    JSON-serialized VaultManifest

Cipher:  XChaCha20Poly1305
         ChaCha20: stream cipher (256-bit, 24-byte nonce)
         Poly1305: MAC (16-byte authentication tag)

Ciphertext = ChaCha20(key, nonce, plaintext)
AuthTag = Poly1305(key, nonce, plaintext)

Output:  [ciphertext || auth_tag] (plaintext_len + 16 bytes)

Verification on decrypt:
         1. Compute Auth' = Poly1305(key, nonce, ciphertext)
         2. Compare Auth' with included Auth (constant-time)
         3. If mismatch, return TAMPER_DETECTED
         4. Else, decrypt plaintext = ChaCha20(key, nonce, ciphertext)
```

### File Blob Encryption (AEAD, per-file)

```
For each imported file:

Key:     32-byte key (same, derived once per session)
Nonce:   24 random bytes (UNIQUE per file)
Data:    File contents (binary, variable size)

Same AEAD scheme as manifest.

Record in manifest:
  blob_position: byte offset in vault file
  blob_encrypted_size: ciphertext_len + 16
  nonce: hex(24-byte nonce)
  ciphertext_hash: SHA256(ciphertext) for tamper detection
```

## Security Properties

### Confidentiality (What's encrypted)

✅ All file contents (binary encrypted)  
✅ Manifest structure (which files stored, metadata)  
✅ Audit log (who accessed what, when)  
✅ File names (part of manifest, encrypted)  

❌ Vault existence (file `~/.vault/main.vault` visible on disk)  
❌ Vault ID (necessary for operation, not sensitive)  
❌ Salt (used for KDF, not sensitive per se)  
❌ Vault header (visible plaintext, used for decryption)  

### Integrity (What's tamper-detected)

✅ Manifest (16-byte Poly1305 tag)  
✅ File contents (per-file Poly1305 tag + SHA256 check)  
✅ Access patterns (audit log, if manifest modified)  

❌ Vault header (not authenticated; acceptable, not secret)  
❌ Vault file size (metadata, not secret)  

### Forward Secrecy

N/A — Vault key derived from password, not ephemeral session key.

If password compromised, all files at-risk. Mitigate by:
- Using strong password
- Changing password regularly
- Monitoring access logs
- Decoy vault for plausible deniability

### Backward Secrecy

N/A — Same as forward secrecy.

### Recovery Properties

✅ Recovery codes derive from salt (publicly visible)  
✅ Recovery codes deterministic (same code always works)  
✅ Recovery codes allow password reset  
✅ Recovery codes cannot decrypt vault directly  

❌ Recovery codes themselves not "secret shares" (single code = full recovery)  

Enhance with optional Shamir Secret Sharing to require k-of-n codes.

---

**Last Updated:** December 2025  
**Vault Version:** 1.0  
**Architecture Revision:** A
