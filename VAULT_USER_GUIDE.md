# Hidden Vault - Security & User Guide

## Overview

The Hidden Vault is a secure encrypted storage system built into the file manager. It allows you to:

- **Store sensitive files** (IDs, financial documents, personal images) encrypted on your device
- **Encrypt files locally** using strong encryption (XChaCha20-Poly1305)
- **Auto-lock after inactivity** to prevent unauthorized access
- **Detect content automatically** and suggest moving sensitive files
- **Recover access** using secure recovery codes

## Security Guarantees

### What the vault protects against:

✅ **Local disk theft**: Files are encrypted and unreadable without password  
✅ **Malware/spyware**: Vault locked, key only in memory while unlocked  
✅ **Casual snooping**: Vault is invisible by default  
✅ **Accidental file sharing**: Files in vault cannot be accidentally exposed  

### What the vault does NOT protect against:

❌ **Weak passwords**: A simple password will be cracked. Use ≥12 characters, mix upper/lower/numbers/symbols  
❌ **Forgotten password without recovery codes**: Data is IRRECOVERABLE. Store recovery codes safely  
❌ **Physical coercion / forensic imaging**: If attacker has full device access and time, they may brute-force password  
❌ **Quantum computers**: Future quantum computers could potentially break current encryption (unlikely before 2030+)  

## Getting Started

### 1. Create Your Vault

**Trigger the vault UI:**
- Press **Ctrl+Alt+V three times** in rapid succession, OR
- Press **Ctrl+Alt+V** multiple times, OR
- Click the "Create New Vault" button (if vault is enabled in app)

**Create vault:**
1. Choose "Create New Vault"
2. Enter a **strong password** (12+ characters recommended):
   - Mix uppercase, lowercase, numbers, symbols
   - Avoid dictionary words, birthdays, pet names
3. Confirm password
4. Save your **recovery codes** immediately (print or write down)

### 2. Save Recovery Codes

⚠️ **CRITICAL**: Recovery codes are your ONLY way to access the vault if you forget your password.

- Print them and store in a safe place (safe, locked drawer)
- Or split across trusted devices/people (see Shamir below)
- **DO NOT store digital-only** without encryption
- **DO NOT share** online or over email

Recovery codes look like:
```
alpha-bravo-charlie
delta-echo-foxtrot
golf-hotel-india
...
```

### 3. Add Files to Vault

**Manual add:**
1. Open the file manager and find a sensitive file
2. Right-click → "Move to Vault" (future feature)
3. Or drag-drop into vault UI

**Auto-detection:**
1. The vault scanner automatically detects:
   - Files with ID numbers (SSN, passport, national ID)
   - Financial documents (.pdf, .xlsx, .csv)
   - Private images (all .jpg, .png, etc.)
   - Config files (.env, secrets)
   - Private keys (.pem, .key, .p12)
2. You'll see "Sensitive files detected" prompt
3. Click files you want to move, confirm move to vault

### 4. Access Files from Vault

1. Trigger vault (Ctrl+Alt+V x3)
2. Enter password
3. Click "Vault Manager"
4. Find your file in the list
5. Click "Extract" → saves decrypted file to Downloads
6. Use the file as needed
7. Lock vault when done (Ctrl+Alt+V again or X button)

## Password & Recovery

### Password Requirements

- **Minimum 12 characters** (16+ recommended for very sensitive data)
- Include: uppercase (A-Z), lowercase (a-z), numbers (0-9), symbols (!@#$%)
- Avoid: your name, birthdate, pet name, common words
- Never reuse passwords from other apps/websites

### Changing Password

1. Unlock vault
2. Click "Settings"
3. Click "Change Password"
4. Confirm new recovery codes

### Forgot Password?

1. Trigger vault (Ctrl+Alt+V x3)
2. Click "Forgot Password"
3. Enter one of your recovery codes
4. Set a new password
5. New recovery codes are generated

### Recovery Code Backup (Shamir Secret Sharing)

Optional: Split recovery codes across multiple trusted people/devices.

**Example (2-of-3 split):**
- Generate codes during vault creation
- Split codes into 3 parts using Shamir Secret Sharing
- Send Part 1 to Mom, Part 2 to Brother, Part 3 to safe-deposit box
- If password lost, get any 2 of 3 parts to recover vault

Requires trusted distribution method (not email!).

## Security Best Practices

### Do's ✅

- ✅ Use a strong, unique password
- ✅ Save recovery codes in multiple safe places
- ✅ Lock vault regularly (Ctrl+Alt+V again)
- ✅ Enable auto-lock in Settings (recommend 5 minutes)
- ✅ Review suggested files for accuracy before moving
- ✅ Move ALL sensitive files to vault (photos, IDs, docs)
- ✅ Backup your device regularly (vault backup included)
- ✅ Test recovery codes once per year

### Don'ts ❌

- ❌ Don't use simple password (12345, password, qwerty)
- ❌ Don't store recovery codes only digitally
- ❌ Don't forget to lock vault after access
- ❌ Don't leave device unlocked unattended
- ❌ Don't share vault password with anyone
- ❌ Don't skip saving recovery codes
- ❌ Don't rely on vault for illegal concealment
- ❌ Don't backup unencrypted recovery codes online

## Decoy Vault (Optional)

**What it does:**
- Creates a second fake vault with plausible content
- Different password from main vault
- Satisfies casual attackers while protecting real vault

**Example use case:**
- Someone forces you to open your vault
- You open the decoy vault instead (less incriminating)
- Real vault remains hidden and encrypted

**Enable:**
1. Unlock main vault
2. Click "Settings"
3. Check "Enable Decoy Vault"
4. Set decoy password (can be simple)
5. Move decoy files to decoy vault
6. Two vaults now exist with separate passwords

**Security note:**
- Decoy vault is NOT a backdoor
- You still need to remember/save both passwords
- Sophisticated attackers might detect two containers
- Plausible deniability has legal limits (consult local laws)

## Auto-Lock & Inactivity

**What it does:**
- Automatically locks vault after inactivity
- Erases encryption key from memory
- Vault stays invisible and unopenable

**Configure:**
1. Unlock vault
2. Click "Settings"
3. Set "Auto-lock after X minutes"
4. Default: 5 minutes

**Events that trigger auto-lock:**
- Inactivity timeout expires
- Screen lock / OS suspend
- Manual lock (click "Lock Vault" button)

## Tamper Detection

The vault detects if files have been modified:

- **AEAD encryption** fails if any bit is flipped
- **Access log** tracks all operations (import, export, lock, unlock)
- **Mismatches** between expected and actual operations alert you to tampering

If tampering detected:
1. Vault warns you on unlock
2. You can export all data safely
3. Contact support if concerned about compromise

## Technical Details

### Encryption Algorithm

- **Cipher**: XChaCha20-Poly1305 AEAD
- **KDF**: Argon2id (64 MB memory, 4 iterations, 4 parallelism)
- **Nonce**: 24-byte random (XChaCha20 extended)
- **Tag**: 16-byte authentication tag (Poly1305)

### File Format

```
[Plaintext JSON Header]
---VAULT_BOUNDARY---
[Encrypted Manifest (JSON)]
[Encrypted File Blobs]
```

See `VAULT_FORMAT_SPEC.md` for details.

### No Backdoor

- No master key exists
- No way to recover without recovery codes
- No "forgot password" button that bypasses recovery
- Lost passwords = lost data (by design)

## Troubleshooting

### "Vault password is incorrect"
- Verify Caps Lock is off
- Ensure you're using correct vault (main vs. decoy)
- Try a recovery code to reset password

### "Recovery code not recognized"
- Recovery codes are case-insensitive but word-specific
- Ensure you copied them correctly (no extra spaces)
- Contact support if codes are lost

### "Vault file is corrupted"
- Vault detected tampering or corruption
- Try to export all data first
- Delete corrupted vault and create new one
- Restore files from backup if possible

### "Can't find files I imported"
- Verify vault is actually unlocked (check for "Vault Manager" button)
- Search in vault for filename
- Files moved to vault are removed from normal file system

### Vault won't unlock
- Password incorrect? Try recovery code
- Vault file deleted/moved? Recreate vault
- Very large vault? Decryption may take time (be patient)

## Privacy & Legal

### What this app does NOT do:

- ❌ We don't track vault contents
- ❌ We don't have access to vault password
- ❌ We don't upload files anywhere
- ❌ We don't have a "master key" or backdoor

### What you should know:

- ✅ You are responsible for your password
- ✅ You are responsible for recovery codes
- ✅ You are responsible for backups
- ✅ Vault is personal use only
- ⚠️ Decoy vault may have legal implications in some jurisdictions
- ⚠️ Concealment of evidence is illegal in most places

### Recommendations:

- Use vault only for **legitimate privacy** (personal documents, private photos)
- Don't use vault for **illegal concealment** (contraband, evidence tampering)
- Understand local laws before using decoy features
- Consult lawyer if law enforcement asks for vault access

## Support & Reporting Issues

If you find a security vulnerability:
1. **Do NOT** post on social media
2. **Do NOT** include recovery codes or passwords
3. **Email** security@[support-email] with details
4. Include: vault version, steps to reproduce, severity

For general issues, use the standard support channels.

---

**Last Updated:** December 2025  
**Vault Version:** 1.0  
**Encryption**: XChaCha20-Poly1305  
