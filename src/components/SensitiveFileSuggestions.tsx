/**
 * SensitiveFileSuggestions Component
 *
 * Displays a list of files flagged as sensitive and allows users to:
 * - Review detected patterns
 * - Move files to vault with one click
 * - Dismiss suggestions
 */

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface SensitiveFileMarker {
  file_path: string;
  file_name: string;
  file_size: number;
  risk_level: string;
  detected_patterns: string[];
  mime_type: string | null;
}

interface SensitiveFileSuggestionsProps {
  directoryPath: string;
  onMoveToVault?: (filePath: string) => void;
}

export default function SensitiveFileSuggestions({
  directoryPath,
  onMoveToVault,
}: SensitiveFileSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SensitiveFileMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Scan directory when it changes
  useEffect(() => {
    scanDirectory();
  }, [directoryPath]);

  const scanDirectory = async () => {
    if (!directoryPath) return;

    setLoading(true);
    setError("");

    try {
      const results = await invoke<SensitiveFileMarker[]>(
        "scan_directory_for_sensitive_files",
        { directory_path: directoryPath }
      );

      // Filter out dismissed items
      const filtered = results.filter((item) => !dismissed.has(item.file_path));
      setSuggestions(filtered);
    } catch (err) {
      setError(`Failed to scan directory: ${String(err)}`);
      setSuggestions([]);
    }

    setLoading(false);
  };

  const handleDismiss = (filePath: string) => {
    setDismissed((prev) => new Set([...prev, filePath]));
    setSuggestions((prev) => prev.filter((item) => item.file_path !== filePath));
  };

  const handleMoveToVault = (filePath: string) => {
    onMoveToVault?.(filePath);
    handleDismiss(filePath);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-red-50 border-red-200";
      case "medium":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h3 className="font-semibold text-gray-800">
          {suggestions.length} Sensitive File{suggestions.length > 1 ? "s" : ""} Detected
        </h3>
        <span className="text-xs text-gray-500 ml-auto">Tip: Move to vault for security</span>
      </div>

      {suggestions.map((file, idx) => (
        <div
          key={file.file_path}
          className={`border rounded-lg p-3 transition-all ${getRiskColor(file.risk_level)}`}
        >
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className={`text-2xl`}>
                  {file.mime_type?.startsWith("image") ? "🖼️" : "📄"}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">{file.file_name}</p>
                <p className="text-xs text-gray-600">
                  {(file.file_size / 1024).toFixed(1)} KB
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${getRiskBadgeColor(file.risk_level)}`}>
                {file.risk_level.toUpperCase()}
              </span>
            </div>
            {expandedIndex === idx ? (
              <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
            )}
          </div>

          {/* Expanded content */}
          {expandedIndex === idx && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Detected patterns:</p>
                <div className="flex flex-wrap gap-2">
                  {file.detected_patterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="inline-block px-2 py-1 bg-white bg-opacity-70 rounded text-xs text-gray-700 border border-current border-opacity-30"
                    >
                      {pattern.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleMoveToVault(file.file_path)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded transition-colors"
                >
                  Move to Vault
                </button>
                <button
                  onClick={() => handleDismiss(file.file_path)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium py-2 rounded transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
