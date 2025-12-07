import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function DuplicateDetectorModal({ shown, setShown, duplicates, onDeleted }: any) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  if (!shown) return null;

  const toggleSelect = (file: string) => {
    setSelected(prev => ({ ...prev, [file]: !prev[file] }));
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
        filesToDelete.push(...group.files.slice(1)); // keep first, delete rest
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-[80%] max-h-[60vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Duplicate Files Found</h2>
            <p className="text-sm text-gray-500">Select files to delete. For each group, the first file is kept by default.</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Groups</div>
            <div className="text-lg font-semibold">{totalGroups}</div>
            <div className="text-sm text-gray-400">Duplicate files</div>
            <div className="text-lg font-semibold text-red-600">{totalDuplicateFiles}</div>
          </div>
        </div>

        {duplicates.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No duplicate files found.</p>
        ) : (
          duplicates.map((group: any, i: number) => (
            <div key={i} className="mb-4 border-b pb-3 last:border-b-0">
              <p className="text-sm font-mono text-gray-600 mb-2 break-all">Hash: {group.hash}</p>
              <div className="space-y-1">
                {group.files.map((file: string, idx: number) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={!!selected[file]}
                      onChange={() => toggleSelect(file)}
                    />
                    <span className="text-sm text-gray-800 break-all">{file}</span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="flex justify-end gap-3">
          <button
            className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded transition"
            onClick={() => setShown(false)}
          >
            Cancel
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition"
            onClick={onDeleteSelected}
          >
            Delete Selected
          </button>
          <button
            className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded transition"
            onClick={onDeleteAll}
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
