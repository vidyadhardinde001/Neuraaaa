/**
 * DirectoryContents Component
 *
 * Renders the list of files/folders in the current directory and provides AI actions.
 * - 📁 Double-click folder → triggers onDirectoryClick (navigate)
 * - 📄 Single-click file → select
 * - AI Summary / AI Rename via backend
 */

import React, { useState } from "react";
import { openFile, renameFile } from "../../ipc";
import { formatBytes, formatDate } from "../../lib/utils";
import { useAppSelector, useAppDispatch } from "../../state/hooks";
import { selectContentIdx } from "../../state/slices/currentDirectorySlice";
import { selectSettings } from "../../state/slices/settingsSlice";
import { FileText, Wand2, Loader2, CheckCircle, AlertTriangle } from "lucide-react";


interface Props {
  content: any[];
  onDirectoryClick: (filePath: string) => void;
  onFileSelect?: (filePath: string | null) => void;
  selectedFile?: string | null;
}

export function DirectoryContents({ content, onDirectoryClick, onFileSelect, selectedFile }: Props) {
  const [modal, setModal] = useState<{ type: "summary" | "rename"; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const dispatch = useAppDispatch();

  // Open a file
  const handleFileOpen = async (path: string) => {
    try {
      await openFile(path);
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  // Get AI summary
  const handleAISummary = async (filePath: string) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      setModal({ type: "summary", content: data.summary || data.error || "No summary available." });
    } catch {
      setModal({ type: "summary", content: "Error contacting AI backend." });
    }
    setLoading(false);
  };

  // Get AI rename suggestion
  const handleAIRename = async (filePath: string) => {
    setLoading(true);
    setRenamePath(filePath);
    try {
      const res = await fetch("http://localhost:5000/ai-rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      setModal({
        type: "rename",
        content: data.suggested_name || data.error || "No suggestion available.",
      });
    } catch {
      setModal({ type: "rename", content: "Error contacting AI backend." });
    }
    setLoading(false);
  };

  // Perform actual rename
  const doRename = async (oldPath: string, suggestedName: string) => {
    const lastSep = Math.max(oldPath.lastIndexOf("/"), oldPath.lastIndexOf("\\"));
    const dir = lastSep >= 0 ? oldPath.substring(0, lastSep) : "";
    const base = lastSep >= 0 ? oldPath.substring(lastSep + 1) : oldPath;
    const ext = base.includes(".") ? base.split(".").pop() || "" : "";

    let baseName = suggestedName.trim();
    if (ext && baseName.endsWith("." + ext)) baseName = baseName.slice(0, -(ext.length + 1));

    const sep = oldPath.includes("\\") ? "\\" : "/";
    const newPath = dir
      ? `${dir}${sep}${baseName}${ext ? "." + ext : ""}`
      : `${baseName}${ext ? "." + ext : ""}`;

    const isTauri = "__TAURI_IPC__" in window;

    if (isTauri) {
      try {
        await renameFile(oldPath, newPath);
        setModal({ type: "rename", content: `✅ File renamed to: ${newPath}` });
      } catch (e) {
        setModal({ type: "rename", content: `❌ Rename failed: ${String(e)}` });
      }
    } else {
      try {
        const res = await fetch("http://localhost:5000/rename-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
        });
        const data = await res.json();
        setModal({
          type: "rename",
          content: data.ok
            ? `✅ File renamed to: ${data.new_path}`
            : `❌ Rename failed: ${data.error || "unknown"}`,
        });
      } catch (e) {
        setModal({ type: "rename", content: `❌ Rename failed: ${String(e)}` });
      }
    }

    setRenamePath(null);
  };

  if (!content || content.length === 0) {
    return (
      <div className="flex justify-center items-center h-24 text-gray-500 text-lg border border-gray-200 rounded-lg bg-gray-50 m-4">
        <p>There are no files in this directory.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-w-[73%]">

      {/* Footer Stats */}
      <div className="ml-3 mb-3 px-1">
        <p className="text-sm text-gray-500">
          {content.length} item{content.length !== 1 ? 's' : ''} • 
          {content.filter(item => {
            const meta = item.meta || item.File || item.Directory || item;
            return !(meta.is_dir || item.type === 'directory' || item.Directory);
          }).length} files • 
          {content.filter(item => {
            const meta = item.meta || item.File || item.Directory || item;
            return meta.is_dir || item.type === 'directory' || item.Directory;
          }).length} folders
        </p>
      </div>
      {/* Global loading bar */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse z-50" />
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              {modal.type === "summary" ? (
                <FileText className="h-5 w-5 text-green-600" />
              ) : (
                <Wand2 className="h-5 w-5 text-blue-600" />
              )}
              <h2 className="text-lg font-semibold text-gray-800">
                {modal.type === "summary" ? "AI File Summary" : "AI Rename Suggestion"}
              </h2>
            </div>

            <div className="mb-4 whitespace-pre-line text-gray-800 border-l-4 border-gray-300 pl-3">
              {modal.content}
            </div>

            {modal.type === "rename" && renamePath && modal.content && !modal.content.startsWith("Error") ? (
              <div className="flex gap-2 justify-end">
                <button
                  className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                  onClick={() => doRename(renamePath, modal.content)}
                >
                  <CheckCircle className="h-4 w-4" />
                  Rename File
                </button>
                <button
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition"
                  onClick={() => {
                    setModal(null);
                    setRenamePath(null);
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition"
                  onClick={() => setModal(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">Size</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-40">Date Modified</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {content.map((item, idx) => {
              if (!item) return null;

              let meta: any = null;
              let isDir = false;

              if (item.meta) {
                meta = item.meta;
                isDir = item.type === "directory" || meta.is_dir;
              } else if (item.File || item.Directory) {
                meta = item.File || item.Directory;
                isDir = !!item.Directory || meta.is_dir;
              } else if (item.type && item.name && item.path) {
                meta = { name: item.name, path: item.path, is_dir: item.is_dir };
                isDir = item.type === "directory" || item.is_dir;
              } else {
                const candidate = (Object.values(item) as any[]).find(
                  (v: any) => v && typeof v.path === "string"
                );
                meta = candidate || { name: JSON.stringify(item), path: "", is_dir: false };
                isDir = meta.is_dir || false;
              }

              const path = meta.path || "";

              return (
                <tr
                  key={idx}
                  role="row"
                  aria-selected={selectedFile === path}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Update Redux selection index so header controls (rename/delete) enable
                    dispatch(selectContentIdx(idx));
                    onFileSelect?.(isDir ? null : path);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (isDir) {
                      onDirectoryClick(path);
                      onFileSelect?.(null);
                    } else {
                      handleFileOpen(path);
                    }
                  }}
                  className={`group cursor-pointer transition-all duration-150 ${
                    selectedFile === path 
                      ? "bg-blue-50 border-l-4 border-l-blue-500" 
                      : "hover:bg-gray-50 border-l-4 border-l-transparent"
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        isDir ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        <span className="text-sm font-medium">
                          {isDir ? "📁" : "📄"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${
                          selectedFile === path ? "text-blue-800" : "text-gray-900"
                        }`}>
                          {meta.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {isDir ? "Folder" : "File"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                    {isDir ? "—" : formatBytes(meta.size)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                    {meta.modified
                      ? formatDate(meta.modified)
                      : meta.created
                      ? formatDate(meta.created)
                      : "—"}
                  </td>

                  {/* AI ACTIONS */}
                  <td className="py-3 px-4">
                    {!isDir && (
                      <div className="flex gap-2 items-center opacity-100 group-hover:opacity-100 transition-opacity duration-200">
                        {/* AI Summary Button */}
                        <button
                          title="Generate AI Summary"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAISummary(path);
                          }}
                          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 border
                            ${
                              loading
                                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-600 hover:text-gray-800 shadow-xs"
                            }`}
                        >
                          {loading ? (
                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* AI Rename Button */}
                        <button
                          title="Get AI Rename Suggestion"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAIRename(path);
                          }}
                          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 border
                            ${
                              loading
                                ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                                : "bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-600 hover:text-gray-800 shadow-xs"
                            }`}
                        >
                          {loading ? (
                            <Loader2 className="animate-spin h-3.5 w-3.5" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      
    </div>
  );
}