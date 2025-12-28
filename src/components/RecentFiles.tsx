import { useEffect, useState } from "react";
import { FileText, Folder, Clock, Trash2, ChevronRight, ExternalLink } from "lucide-react";
import { formatDate, formatBytes } from "../lib/utils";
import { openFile } from "../ipc";

export interface RecentFile {
  path: string;
  name: string;
  isDirectory: boolean;
  openedAt: string; // ISO timestamp
  size?: number;
}

interface RecentFilesProps {
  recentFiles: RecentFile[];
  onFileSelect: (path: string) => void;
  onClear: () => void;
}

export default function RecentFiles({ recentFiles, onFileSelect, onClear }: RecentFilesProps) {
  if (recentFiles.length === 0) {
    return null;
  }

  const handleOpenFile = async (file: RecentFile) => {
    try {
      // For directories, just select them in the file manager
      if (file.isDirectory) {
        onFileSelect(file.path);
      } else {
        // For files, open them with the default application
        await openFile(file.path);
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  return (
    <div className="mt-8 px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Recently Opened
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-500 transition flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200 shadow-sm">
        {recentFiles.map((file, index) => {
          const fileName = file.name || file.path.split(/[\\/]/).pop() || "Unknown";
          const dirPath = file.path.split(/[\\/]/).slice(0, -1).join("\\");

          return (
            <div
              key={index}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {file.isDirectory ? (
                  <Folder className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileText className="w-5 h-5 text-gray-500" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition">
                  {fileName}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5" title={file.path}>
                  {dirPath || "Root"}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex-shrink-0 flex items-center gap-3 text-xs text-gray-500">
                {file.size && !file.isDirectory && (
                  <span className="hidden sm:inline">{formatBytes(file.size)}</span>
                )}
                <span className="hidden sm:inline">{formatDate(file.openedAt)}</span>
              </div>

              {/* Open button */}
              <button
                onClick={() => handleOpenFile(file)}
                className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 transition hover:bg-blue-100 rounded-lg"
                title={file.isDirectory ? "Open folder" : "Open file"}
              >
                <ExternalLink className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
