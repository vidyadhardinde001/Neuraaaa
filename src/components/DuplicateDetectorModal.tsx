import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, FileText, Copy, CheckCircle2, Circle } from "lucide-react";

export default function DuplicateDetectorModal({ shown, setShown, duplicates, onDeleted }: any) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  if (!shown) return null;

  const toggleSelect = (file: string) => {
    setSelected(prev => ({ ...prev, [file]: !prev[file] }));
  };

  const toggleGroupExpanded = (index: number) => {
    setExpandedGroups(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const selectAllInGroup = (group: any) => {
    group.files.forEach((file: string, idx: number) => {
      if (idx > 0) {
        setSelected(prev => ({ ...prev, [file]: true }));
      }
    });
  };

  async function onDeleteSelected() {
    const filesToDelete = Object.keys(selected).filter(f => selected[f]);
    if (filesToDelete.length === 0) {
      alert("No files selected.");
      return;
    }
    await invoke("delete_files", { files: filesToDelete });
    alert(`Deleted ${filesToDelete.length} files.`);
    setShown(false);
    onDeleted?.(filesToDelete);
  }

  async function onDeleteAll() {
    const filesToDelete: string[] = [];
    duplicates.forEach((group: any) => {
      if (group.files.length > 1) {
        filesToDelete.push(...group.files.slice(1));
      }
    });
    if (filesToDelete.length === 0) {
      alert("No duplicates to delete.");
      return;
    }
    await invoke("delete_files", { files: filesToDelete });
    alert(`Deleted ${filesToDelete.length} files.`);
    setShown(false);
    onDeleted?.(filesToDelete);
  }

  const totalGroups = duplicates?.length ?? 0;
  const totalDuplicateFiles = duplicates?.reduce((acc: number, g: any) => acc + Math.max(0, g.files.length - 1), 0) ?? 0;
  const totalSelectedFiles = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-200 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Duplicate Files Found</h2>
                <p className="text-sm text-gray-600 mt-1">Review and delete duplicate files to free up space</p>
              </div>
            </div>
            <button
              onClick={() => setShown(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-red-100">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Groups</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{totalGroups}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-red-100">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duplicates</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{totalDuplicateFiles}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-red-100">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Selected</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{totalSelectedFiles}</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {duplicates.length === 0 ? (
            <div className="flex items-center justify-center py-12 px-6">
              <div className="text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No duplicate files found</p>
                <p className="text-sm text-gray-400 mt-1">Your files are unique</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 p-4 space-y-3">
              {duplicates.map((group: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroupExpanded(i)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition text-left"
                  >
                    <div className="text-gray-400">
                      {expandedGroups[i] ? '▼' : '▶'}
                    </div>
                    <FileText className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-500 truncate">Hash: {group.hash.substring(0, 16)}...</p>
                      <p className="text-xs text-gray-400 mt-1">{group.files.length} files</p>
                    </div>
                    {group.files.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInGroup(group);
                        }}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-medium"
                      >
                        Select Others
                      </button>
                    )}
                  </button>

                  {/* Group Files */}
                  {expandedGroups[i] && (
                    <div className="border-t border-gray-200 bg-white">
                      {group.files.map((file: string, idx: number) => {
                        const isSelected = !!selected[file];
                        const isFirst = idx === 0;
                        
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition cursor-pointer border-b border-gray-100 last:border-b-0 ${
                              isFirst ? 'bg-green-50' : ''
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isFirst ? (
                                <div className="w-5 h-5 rounded border-2 border-green-500 bg-green-50 flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                </div>
                              ) : (
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 rounded border-gray-300 cursor-pointer accent-red-500"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(file)}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 truncate font-medium">{file.split(/[\\/]/).pop()}</p>
                              <p className="text-xs text-gray-500 truncate mt-1">{file}</p>
                            </div>
                            {isFirst && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium whitespace-nowrap">
                                Keep
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(file);
                              }}
                              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Copy path"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 flex gap-3 justify-end">
          <button
            className="px-4 py-2 text-gray-700 font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            onClick={() => setShown(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-white font-medium bg-orange-500 hover:bg-orange-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onDeleteSelected}
            disabled={totalSelectedFiles === 0}
          >
            Delete {totalSelectedFiles > 0 ? `${totalSelectedFiles} Selected` : 'Selected'}
          </button>
          <button
            className="px-4 py-2 text-white font-medium bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onDeleteAll}
            disabled={totalDuplicateFiles === 0}
          >
            Delete All Duplicates
          </button>
        </div>
      </div>
    </div>
  );
}
