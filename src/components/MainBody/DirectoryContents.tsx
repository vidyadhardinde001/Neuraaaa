/**
 * DirectoryContents Component
 *
 * Renders the list of files/folders in the current directory and provides AI actions.
 * - 📁 Double-click folder → triggers onDirectoryClick (navigate)
 * - 📄 Single-click file → select
 * - AI Summary / AI Rename via backend
 */

import React, { useState } from 'react';
import { openFile, renameFile } from '../../ipc';
import { formatBytes, formatDate } from '../../lib/utils';

interface Props {
  content: any[];
  onDirectoryClick: (filePath: string) => void;
  onFileSelect?: (filePath: string | null) => void;
  selectedFile?: string | null;
}

export function DirectoryContents({ content, onDirectoryClick, onFileSelect, selectedFile }: Props) {
  const [modal, setModal] = useState<{ type: 'summary' | 'rename'; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [renamePath, setRenamePath] = useState<string | null>(null);

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
      const res = await fetch('http://localhost:5000/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      setModal({ type: 'summary', content: data.summary || data.error || 'No summary available.' });
    } catch {
      setModal({ type: 'summary', content: 'Error contacting AI backend.' });
    }
    setLoading(false);
  };

  // Get AI rename suggestion
  const handleAIRename = async (filePath: string) => {
    setLoading(true);
    setRenamePath(filePath);
    try {
      const res = await fetch('http://localhost:5000/ai-rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      setModal({ type: 'rename', content: data.suggested_name || data.error || 'No suggestion available.' });
    } catch {
      setModal({ type: 'rename', content: 'Error contacting AI backend.' });
    }
    setLoading(false);
  };

  // Perform actual rename
  const doRename = async (oldPath: string, suggestedName: string) => {
    const lastSep = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'));
    const dir = lastSep >= 0 ? oldPath.substring(0, lastSep) : '';
    const base = lastSep >= 0 ? oldPath.substring(lastSep + 1) : oldPath;
    const ext = base.includes('.') ? base.split('.').pop() || '' : '';

    let baseName = suggestedName.trim();
    if (ext && baseName.endsWith('.' + ext)) baseName = baseName.slice(0, -(ext.length + 1));

    const sep = oldPath.includes('\\') ? '\\' : '/';
    const newPath = dir ? `${dir}${sep}${baseName}${ext ? '.' + ext : ''}` : `${baseName}${ext ? '.' + ext : ''}`;

    const isTauri = '__TAURI_IPC__' in window;

    if (isTauri) {
      try {
        await renameFile(oldPath, newPath);
        setModal({ type: 'rename', content: `File renamed to: ${newPath}` });
      } catch (e) {
        setModal({ type: 'rename', content: `Rename failed: ${String(e)}` });
      }
    } else {
      try {
        const res = await fetch('http://localhost:5000/rename-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
        });
        const data = await res.json();
        setModal({ type: 'rename', content: data.ok ? `File renamed to: ${data.new_path}` : `Rename failed: ${data.error || 'unknown'}` });
      } catch (e) {
        setModal({ type: 'rename', content: `Rename failed: ${String(e)}` });
      }
    }

    setRenamePath(null);
  };

  if (!content || content.length === 0) {
    return (
      <div className="flex justify-center items-center h-24 text-gray-500 text-lg">
        <p>There are no files in this directory.</p>
      </div>
    );
  }

  return (
    <div className="p-2 overflow-auto">
      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full">
            <div className="mb-4 font-bold text-lg">{modal.type === 'summary' ? 'AI File Summary' : 'AI Rename Suggestion'}</div>
            <div className="mb-4 whitespace-pre-line text-gray-800">{modal.content}</div>

            {modal.type === 'rename' && renamePath && modal.content && !modal.content.startsWith('Error') ? (
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  onClick={() => doRename(renamePath, modal.content)}
                >
                  Rename File
                </button>
                <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400" onClick={() => { setModal(null); setRenamePath(null); }}>
                  Close
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400" onClick={() => setModal(null)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <table className="min-w-[60%] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-2 px-3">Name</th>
            <th className="py-2 px-3 w-32">Size</th>
            <th className="py-2 px-3 w-40">Date</th>
            <th className="py-2 px-3 w-48">AI Actions</th>
          </tr>
        </thead>
        <tbody>
          {content.map((item, idx) => {
            if (!item) return null;

            let meta: any = null;
            let isDir = false;

            if (item.meta) {
              meta = item.meta;
              isDir = item.type === 'directory' || meta.is_dir;
            } else if (item.File || item.Directory) {
              meta = item.File || item.Directory;
              isDir = !!item.Directory || meta.is_dir;
            } else if (item.type && item.name && item.path) {
              meta = { name: item.name, path: item.path, is_dir: item.is_dir };
              isDir = item.type === 'directory' || item.is_dir;
            } else {
              const candidate = (Object.values(item) as any[]).find((v: any) => v && typeof v.path === 'string');
              meta = candidate || { name: JSON.stringify(item), path: '', is_dir: false };
              isDir = meta.is_dir || false;
            }

            const path = meta.path || '';

            return (
              <tr
                key={idx}
                role="row"
                aria-selected={selectedFile === path}
                onClick={(e) => { e.stopPropagation(); onFileSelect?.(isDir ? null : path); }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isDir) { onDirectoryClick(path); onFileSelect?.(null); }
                  else { handleFileOpen(path); }
                }}
                className={`cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${selectedFile === path ? 'bg-blue-50' : ''}`}
              >
                <td className="py-2 px-3 align-top">
                  <div className="flex items-center gap-3">
                    <span className={`flex-shrink-0 text-2xl font-bold w-6 text-center ${isDir ? 'text-blue-500' : 'text-gray-400'}`}>{isDir ? '📁' : '📄'}</span>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${selectedFile === path ? 'bg-blue-100 text-blue-800 px-1 rounded' : 'text-gray-800'}`}>{meta.name}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">{isDir ? 'Folder' : formatBytes(meta.size)}</td>
                <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">{meta.modified ? formatDate(meta.modified) : meta.created ? formatDate(meta.created) : ''}</td>
                <td className="py-2 px-3 align-top text-xs">
                  {!isDir && (
                    <div className="flex gap-2">
                      <button className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs" disabled={loading} onClick={e => { e.stopPropagation(); handleAISummary(path); }}>
                        AI Summary
                      </button>
                      <button className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs" disabled={loading} onClick={e => { e.stopPropagation(); handleAIRename(path); }}>
                        AI Rename
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
  );
}
