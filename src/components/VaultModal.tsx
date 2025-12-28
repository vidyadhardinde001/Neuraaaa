/**
 * VaultModal Component
 *
 * Provides:
 * - Vault creation UI (password setup, recovery codes generation)
 * - Vault unlock/authentication UI
 * - Vault manager (list, import, export, delete entries)
 * - Settings (auto-lock, decoy vault, recovery options)
 */

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { join } from "@tauri-apps/api/path";
import Input, { InputSize } from "../ui/Input";

// Spinner component
const Spinner = () => (
  <div className="inline-block animate-spin">
    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
  </div>
);

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type VaultScreen = "menu" | "create" | "unlock" | "manager" | "settings" | "recovery";

interface VaultEntry {
  id: string;
  filename: string;
  file_size: number;
  imported_at: string;
  tags: string[];
}

export default function VaultModal({ isOpen, onClose }: VaultModalProps) {
  const [screen, setScreen] = useState<VaultScreen>("menu");
  const [vaultPath, setVaultPath] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirm, setPasswordConfirm] = useState<string>("");
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [recoveryCodesShown, setRecoveryCodesShown] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [decoyEnabled, setDecoyEnabled] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [operatingEntryId, setOperatingEntryId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateVault = async () => {
    setError("");
    setLoading(true);

    if (!password || !passwordConfirm) {
      setError("Please enter and confirm a password");
      setLoading(false);
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      setLoading(false);
      return;
    }

    try {
      const result = await invoke<[string, string[]]>("vault_create", {
        vaultPath: vaultPath || ".vault/main.vault",
        password: password,
        vaultName: "Main Vault",
      });

      const [id, codes] = result;
      setVaultId(id);
      setRecoveryCodesShown(codes);
      setScreen("recovery");
    } catch (err) {
      setError(`Failed to create vault: ${String(err)}`);
    }

    setLoading(false);
  };

  const handleUnlockVault = async () => {
    setError("");
    setLoading(true);

    if (!password) {
      setError("Please enter your vault password");
      setLoading(false);
      return;
    }

    try {
      const [vaultId, entries] = await invoke<[string, VaultEntry[]]>("vault_open", {
        vaultPath: vaultPath || ".vault/main.vault",
        password: password,
      });

      setVaultId(vaultId);
      setEntries(entries);
      setScreen("manager");
    } catch (err) {
      setError(`Failed to unlock vault: ${String(err)}`);
    }

    setLoading(false);
  };

  const handleCopyRecoveryCodes = () => {
    const codes = recoveryCodesShown.join("\n");
    navigator.clipboard.writeText(codes);
  };

  const handleImportFile = async (filePath: string) => {
    if (!vaultId) {
      setError("Vault not unlocked");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const entryId = await invoke<string>("vault_import_file", {
        vaultPath: vaultPath || ".vault/main.vault",
        password: password,
        sourcePath: filePath,
        tags: [],
        deleteAfter: true,  // Delete original file after import
      });

      setError(`✅ File imported successfully and deleted from original location`);
      
      // Refresh entries list
      const updatedEntries = await invoke<VaultEntry[]>("vault_list_entries", {
        vaultPath: vaultPath || ".vault/main.vault",
        password: password,
      });
      setEntries(updatedEntries);
    } catch (err) {
      setError(`Failed to import file: ${String(err)}`);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">🔐 Hidden Vault</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Menu Screen */}
        {screen === "menu" && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">Welcome to your Hidden Vault</p>
            
            {/* Security Information Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">🔒 Your Files Are Secure</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>✓ <strong>XChaCha20-Poly1305</strong> military-grade encryption</li>
                <li>✓ <strong>Argon2id</strong> password hashing with salt</li>
                <li>✓ <strong>12-byte random nonce</strong> per file</li>
                <li>✓ <strong>Isolated container</strong> - separate encrypted file</li>
                <li>✓ <strong>Zero plaintext storage</strong> - only encrypted data</li>
                <li>✓ <strong>Recovery codes</strong> for account recovery</li>
              </ul>
            </div>

            <button
              onClick={() => setScreen("create")}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg"
            >
              Create New Vault
            </button>
            <button
              onClick={() => setScreen("unlock")}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg"
            >
              Unlock Existing Vault
            </button>
            <button
              onClick={() => setScreen("settings")}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 rounded-lg"
            >
              Settings & Recovery
            </button>
          </div>
        )}

        {/* Create Vault Screen */}
        {screen === "create" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Create a new secure encrypted vault for your sensitive files.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password (minimum 12 characters)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

            <button
              onClick={handleCreateVault}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Vault"}
            </button>

            <button
              onClick={() => setScreen("menu")}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-lg"
            >
              Back
            </button>
          </div>
        )}

        {/* Unlock Vault Screen */}
        {screen === "unlock" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">Enter your vault password to unlock.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter vault password"
                className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

            <button
              onClick={handleUnlockVault}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? "Unlocking..." : "Unlock Vault"}
            </button>

            <button
              onClick={() => setScreen("menu")}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-lg"
            >
              Back
            </button>
          </div>
        )}

        {/* Recovery Codes Screen */}
        {screen === "recovery" && recoveryCodesShown.length > 0 && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Save Your Recovery Codes</p>
              <p className="text-xs text-yellow-700 mb-4">
                These codes are your only way to recover your vault if you forget your password.
                Store them safely (print, write down, or secure digital storage).
              </p>
              <div className="bg-white border border-yellow-300 rounded p-3 font-mono text-xs space-y-1 mb-4">
                {recoveryCodesShown.map((code, idx) => (
                  <div key={idx} className="text-gray-700">
                    {code}
                  </div>
                ))}
              </div>
              <button
                onClick={handleCopyRecoveryCodes}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 rounded"
              >
                Copy to Clipboard
              </button>
            </div>

            <button
              onClick={() => {
                setScreen("manager");
                setPassword("");
                setPasswordConfirm("");
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg"
            >
              I Saved My Recovery Codes
            </button>
          </div>
        )}

        {/* Manager Screen */}
        {screen === "manager" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 font-semibold">Vault Manager</p>
              <p className="text-xs text-gray-500">{entries.length} file{entries.length !== 1 ? 's' : ''}</p>
            </div>

            {error && <div className="text-blue-600 text-sm bg-blue-50 p-2 rounded">{error}</div>}

            {/* Bulk Actions */}
            {selectedEntries.size > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-yellow-900">{selectedEntries.size} file{selectedEntries.size !== 1 ? 's' : ''} selected</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        let processed = 0;
                        for (const entryId of selectedEntries) {
                          const entry = entries.find(e => e.id === entryId);
                          if (!entry) continue;
                          
                          const outputPath = await save({
                            title: `Extract ${entry.filename}`,
                            defaultPath: entry.filename,
                          });

                          if (outputPath) {
                            setError(`Extracting ${processed + 1}/${selectedEntries.size}...`);
                            await invoke("vault_export_file", {
                              vaultPath: vaultPath || ".vault/main.vault",
                              password: password,
                              entryId: entryId,
                              outputPath: outputPath,
                            });
                            processed++;
                          }
                        }
                        setError(`✅ ${processed} file(s) extracted successfully`);
                        setSelectedEntries(new Set());
                      } catch (err) {
                        setError(`Failed to extract files: ${String(err)}`);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium py-1 rounded flex items-center justify-center gap-1"
                  >
                    {loading ? <><Spinner /> Extracting...</> : <>Extract {selectedEntries.size}</>}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${selectedEntries.size} file(s) permanently? This cannot be undone.`)) return;
                      setLoading(true);
                      try {
                        let deleted = 0;
                        for (const entryId of selectedEntries) {
                          setError(`Deleting ${deleted + 1}/${selectedEntries.size}...`);
                          await invoke("vault_delete_entry", {
                            vaultPath: vaultPath || ".vault/main.vault",
                            password: password,
                            entryId: entryId,
                          });
                          deleted++;
                        }
                        setError(`✅ ${deleted} file(s) deleted permanently`);
                        const updatedEntries = await invoke<VaultEntry[]>("vault_list_entries", {
                          vaultPath: vaultPath || ".vault/main.vault",
                          password: password,
                        });
                        setEntries(updatedEntries);
                        setSelectedEntries(new Set());
                      } catch (err) {
                        setError(`Failed to delete files: ${String(err)}`);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium py-1 rounded flex items-center justify-center gap-1"
                  >
                    {loading ? <><Spinner /> Deleting...</> : <>Delete {selectedEntries.size}</>}
                  </button>
                  <button
                    onClick={() => setSelectedEntries(new Set())}
                    disabled={loading}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-gray-800 text-xs font-medium py-1 rounded"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                try {
                  const file = await open({
                    title: "Select file to add to vault",
                    multiple: false,
                  });
                  if (file) {
                    handleImportFile(file as string);
                  }
                } catch (err) {
                  setError(`Failed to pick file: ${String(err)}`);
                }
              }}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Importing...</> : <>➕ Add File to Vault</>}
            </button>

            {entries.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="mb-2">No files in vault yet</p>
                <p className="text-xs">Click "Add File to Vault" to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                      selectedEntries.has(entry.id)
                        ? "bg-blue-100 border border-blue-300"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntries.has(entry.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedEntries);
                        if (e.target.checked) {
                          newSelected.add(entry.id);
                        } else {
                          newSelected.delete(entry.id);
                        }
                        setSelectedEntries(newSelected);
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.filename}</p>
                      <p className="text-xs text-gray-500">{(entry.file_size / 1024).toFixed(2)} KB</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={async () => {
                          setOperatingEntryId(entry.id);
                          try {
                            setError(`Extracting ${entry.filename}...`);
                            const outputPath = await save({
                              title: `Extract ${entry.filename}`,
                              defaultPath: entry.filename,
                            });

                            if (!outputPath) {
                              setError("Extraction cancelled");
                              setOperatingEntryId(null);
                              return;
                            }

                            await invoke("vault_export_file", {
                              vaultPath: vaultPath || ".vault/main.vault",
                              password: password,
                              entryId: entry.id,
                              outputPath: outputPath,
                            });
                            setError(`✅ File extracted: ${entry.filename}`);
                          } catch (err) {
                            const errorMsg = String(err);
                            if (errorMsg.includes("before encrypted data storage")) {
                              setError(
                                `⚠️ ${entry.filename} needs to be re-imported to enable extraction. ` +
                                `Delete and add it again.`
                              );
                            } else {
                              setError(`Failed to extract file: ${errorMsg}`);
                            }
                          }
                          setOperatingEntryId(null);
                        }}
                        disabled={operatingEntryId === entry.id}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
                      >
                        {operatingEntryId === entry.id ? <><Spinner /></> : <>Extract</>}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${entry.filename}" permanently? This cannot be undone.`)) return;
                          setOperatingEntryId(entry.id);
                          try {
                            setError(`Deleting ${entry.filename}...`);
                            await invoke("vault_delete_entry", {
                              vaultPath: vaultPath || ".vault/main.vault",
                              password: password,
                              entryId: entry.id,
                            });
                            setError(`✅ File deleted: ${entry.filename}`);
                            const updatedEntries = await invoke<VaultEntry[]>("vault_list_entries", {
                              vaultPath: vaultPath || ".vault/main.vault",
                              password: password,
                            });
                            setEntries(updatedEntries);
                            setSelectedEntries(new Set());
                          } catch (err) {
                            setError(`Failed to delete file: ${String(err)}`);
                          }
                          setOperatingEntryId(null);
                        }}
                        disabled={operatingEntryId === entry.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1"
                      >
                        {operatingEntryId === entry.id ? <><Spinner /></> : <>Delete</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setScreen("settings")}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 rounded-lg text-sm"
            >
              Settings
            </button>

            <button
              onClick={() => {
                invoke("vault_lock", { vaultId: vaultId || "main" });
                setScreen("menu");
                setPassword("");
                setSelectedEntries(new Set());
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg"
            >
              🔒 Lock Vault
            </button>
          </div>
        )}

        {/* Settings Screen */}
        {screen === "settings" && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-800 mb-4">Vault Settings</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-lock after (minutes)
              </label>
              <input
                type="number"
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="decoy"
                checked={decoyEnabled}
                onChange={(e) => setDecoyEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="decoy" className="text-sm text-gray-700">
                Enable Decoy Vault (separate password)
              </label>
            </div>

            <button
              onClick={() => {
                invoke("vault_generate_recovery_codes", {
                  vaultId: vaultId || "main",
                }).then((codes) => {
                  setRecoveryCodesShown(codes as string[]);
                  setScreen("recovery");
                });
              }}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded-lg text-sm"
            >
              Generate New Recovery Codes
            </button>

            <button
              onClick={() => setScreen(entries.length > 0 ? "manager" : "menu")}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-lg"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
