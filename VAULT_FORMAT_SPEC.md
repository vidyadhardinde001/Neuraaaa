/**
 * HIDDEN VAULT CONTAINER FORMAT SPECIFICATION
 * 
 * This document describes the binary container format for encrypted vault storage.
 * 
 * Version: 1.0
 * Encryption: XChaCha20-Poly1305 AEAD
 * KDF: Argon2id
 */

// ============================================================================
// FILE STRUCTURE OVERVIEW
// ============================================================================
//
// Vault File Layout:
// ┌─────────────────────────────────────────────────────────┐
// │  [JSON HEADER]  (plaintext, includes metadata)          │
// │  \n---VAULT_BOUNDARY---\n                               │
// │  [ENCRYPTED MANIFEST] (manifest as encrypted JSON)      │
// │  [ENCRYPTED FILE BLOBS] (individual encrypted files)    │
// └─────────────────────────────────────────────────────────┘
//

// ============================================================================
// 1. VAULT HEADER (Plaintext JSON)
// ============================================================================
//
// Stored before the boundary marker. Contains KDF parameters and vault metadata.
//
// Example:
// {
//   "version": 1,
//   "created_at": "2025-12-10T12:34:56Z",
//   "salt": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
//   "argon2_params": "m=65536,t=4,p=4",
//   "vault_id": "550e8400-e29b-41d4-a716-446655440000"
// }
//
// Fields:
//   - version (u32): Vault format version (currently 1)
//   - created_at (ISO 8601): Creation timestamp
//   - salt (hex string, 16 bytes): Random salt for Argon2id
//   - argon2_params (string): Argon2id parameters (m=memory, t=time, p=parallelism)
//   - vault_id (UUID v4): Unique identifier for this vault
//

// ============================================================================
// 2. VAULT MANIFEST (Encrypted JSON)
// ============================================================================
//
// The manifest contains metadata about all files in the vault.
// Encrypted using ChaCha20-Poly1305 with key derived from password + salt.
//
// Example (before encryption):
// {
//   "entries": {
//     "550e8400-e29b-41d4-a716-446655440001": {
//       "id": "550e8400-e29b-41d4-a716-446655440001",
//       "filename": "tax_return_2024.pdf",
//       "original_path": "/home/user/Documents/tax_return_2024.pdf",
//       "file_size": 1048576,
//       "mime_type": "application/pdf",
//       "imported_at": "2025-12-10T13:00:00Z",
//       "nonce": "c0ffee1a2b3c4d5e6f7g8h9i0j1k2l3m",
//       "tags": ["financial", "tax"]
//     }
//   },
//   "last_accessed": "2025-12-10T15:30:00Z",
//   "access_log": [
//     {
//       "timestamp": "2025-12-10T13:00:00Z",
//       "action": "vault_created",
//       "entry_id": null,
//       "status": "success"
//     },
//     {
//       "timestamp": "2025-12-10T13:05:00Z",
//       "action": "import",
//       "entry_id": "550e8400-e29b-41d4-a716-446655440001",
//       "status": "success"
//     }
//   ]
// }
//
// Manifest Structure:
//   - entries (map): Entry ID → VaultEntry
//   - last_accessed (ISO 8601): Last time vault was unlocked
//   - access_log (array): Tamper detection audit log
//
// VaultEntry:
//   - id (UUID v4): Unique entry identifier
//   - filename (string): Original filename
//   - original_path (string): Original full path
//   - file_size (u64): File size in bytes
//   - mime_type (string, optional): MIME type
//   - imported_at (ISO 8601): Import timestamp
//   - nonce (hex string, 24 bytes): XChaCha20 nonce for this entry
//   - tags (array): User-defined tags for organizing files
//
// AuditLog Entry:
//   - timestamp (ISO 8601): When action occurred
//   - action (string): Action type (vault_created, import, export, delete, access)
//   - entry_id (UUID, optional): Entry affected (null for vault-level actions)
//   - status (string): "success" or error message
//

// ============================================================================
// 3. ENCRYPTION DETAILS
// ============================================================================
//
// KEY DERIVATION:
//   Input: password (user), salt (random 16 bytes from header), argon2_params
//   Process:
//     1. Parse argon2_params: m (memory in KiB), t (time iterations), p (parallelism)
//     2. Call Argon2id(password, salt, m, t, p) → 32-byte key
//     3. Erase password from memory after derivation
//   Output: 32-byte encryption key
//
// ENCRYPTION (XChaCha20-Poly1305):
//   - Cipher: ChaCha20 (stream) + Poly1305 (MAC)
//   - Nonce size: 24 bytes (XChaCha20 extended nonce)
//   - Tag size: 16 bytes (authentication tag)
//   - Each encrypted object uses a unique random nonce
//
//   Encrypted data format:
//   ┌──────────────────────────────────────────────────┐
//   │ [12-byte random nonce]                           │
//   │ [encrypted plaintext]                            │
//   │ [16-byte authentication tag (appended by AEAD)]  │
//   └──────────────────────────────────────────────────┘
//
//   Process:
//     1. Generate random 24-byte nonce
//     2. plaintext_bytes = JSON.serialize(data)
//     3. ciphertext = ChaCha20Poly1305.encrypt(key, nonce, plaintext_bytes)
//     4. output = nonce || ciphertext (nonce prepended)
//

// ============================================================================
// 4. FILE BLOB STORAGE
// ============================================================================
//
// Each file imported into the vault is encrypted individually.
// In the current simple implementation, blobs are embedded in the manifest
// as a separate encrypted JSON structure.
//
// Future optimized format:
//   After manifest, append file blobs as:
//   ┌────────────────────────────────────┐
//   │ entry_id (UUID string)             │
//   │ encrypted file data                │
//   │ (separated by boundary markers)    │
//   └────────────────────────────────────┘
//

// ============================================================================
// 5. PASSWORD RECOVERY
// ============================================================================
//
// Recovery codes are generated during vault creation and shared with user.
// They are NOT stored in the vault (by design).
//
// Recovery code format (simple): 4 groups of 3 words from word list
//   Example: "alpha-bravo-charlie delta-echo-foxtrot golf-hotel-india ..."
//
// Recovery process:
//   1. User provides recovery code
//   2. Hash recovery code to derive an alternative master key
//   3. Use that key to unlock manifest and reset password
//
// Optional: Shamir Secret Sharing
//   - Split recovery key into N shares, require K to recover
//   - User distributes shares to trusted contacts/devices
//   - Example: 3-of-5 (need any 3 of 5 shares)
//

// ============================================================================
// 6. TAMPER DETECTION
// ============================================================================
//
// Tamper detection mechanisms:
//
//   A. AEAD Integrity:
//      - ChaCha20-Poly1305 provides authenticated encryption
//      - Any bit flip in ciphertext causes decryption to fail
//      - Failure indicates tampering
//
//   B. Audit Log:
//      - Access_log field tracks all operations
//      - Timestamp mismatches or unexpected entries indicate tampering
//      - Attacker cannot add/modify log without having encryption key
//
//   C. Manifest Signature (optional future):
//      - HMAC(key, manifest_json) stored separately
//      - Detects manifest modifications
//

// ============================================================================
// 7. DECOY VAULT SUPPORT
// ============================================================================
//
// Decoy vaults are completely separate containers with their own:
//   - Encryption key (derived from different password)
//   - Manifest and file blobs
//   - Separate vault_id
//
// File locations:
//   Main vault: ~/.vault/main.vault
//   Decoy vault: ~/.vault/decoy.vault
//
// Security note:
//   - Decoy key should NOT be derivable from main key
//   - Separate password required for decoy
//   - UI should prevent accidental linking between decoy and main

// ============================================================================
// 8. EXAMPLE: DECRYPTION PROCESS
// ============================================================================
//
// 1. Read vault file
// 2. Parse plaintext header until "\n---VAULT_BOUNDARY---\n"
// 3. Extract salt and argon2_params from header
// 4. Prompt user for password
// 5. Derive key: key = Argon2id(password, salt, argon2_params)
// 6. Read encrypted manifest (after boundary)
// 7. Decrypt: plaintext = ChaCha20Poly1305.decrypt(key, nonce, ciphertext)
//    - Extract first 12 bytes as nonce
//    - Decrypt remaining bytes
//    - AEAD will fail if password is wrong or ciphertext is tampered
// 8. Parse plaintext as JSON → VaultManifest
// 9. Verify access_log for unexpected modifications
// 10. Session created with in-memory key and manifest
// 11. On export: decrypt individual file blob with key
// 12. On lock: erase key from memory

// ============================================================================
// 9. SECURITY PROPERTIES
// ============================================================================
//
// Forward secrecy:
//   - Encryption key derived fresh from password each unlock
//   - No master key stored; key erased on lock
//
// Backward secrecy:
//   - Old vault versions can be upgraded with key rotation
//   - New files encrypted with new key version
//
// Resistance to brute-force:
//   - Argon2id with high memory cost (65536 KiB default)
//   - Makes password cracking slow: ~1 attempt per second on modern CPU
//   - Recommend minimum 12-character password
//
// Resistance to forgetting password:
//   - Recovery codes are the only recovery mechanism
//   - No backdoor or master key
//   - Vault is irrecoverable without recovery codes
//   - User must store recovery codes safely
//

// ============================================================================
// 10. UPGRADE PATH
// ============================================================================
//
// Version 2 (future):
//   - Separate file blob storage (not embedded in manifest)
//   - Streaming encryption for very large files
//   - Optional on-disk key wrapping with OS keystore
//   - Encrypted metadata alongside blobs (access times, etc.)
//
// Compatibility:
//   - Always check `version` field in header
//   - Upgrade vault by re-encrypting with new version
//   - Keep old vault as backup during transition
//
