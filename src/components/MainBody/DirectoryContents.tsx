/**
 * DirectoryContents Component
 *
 * Renders the list of files/folders in the current directory.
 * - 📁 Double-click folder → triggers onDirectoryClick (navigate)
 * - 📄 Double-click file → calls openFile (via Tauri IPC)
 * - Shows placeholder if directory is empty.
 *
 * Dependencies (communicates with):
 * - ../../types → DirectoryContent, DirectoryContentType
 * - ../../ipc → openFile (Tauri IPC call)
 * - Parent Component (e.g., Explorer/DirectoryView) → provides content + onDirectoryClick
 *
 * If modified, also check:
 * - types.ts (if DirectoryContent structure changes)
 * - ipc.ts (if openFile changes)
 * - Parent explorer component (where navigation logic lives)
 */


import React from 'react';
import { openFile } from '../../ipc';
import { DirectoryChild } from '../../types';
import { formatBytes, formatDate } from '../../lib/utils';

interface Props {
  // content shape may differ across IPC responses; accept any and normalize below
  content: any[];
  onDirectoryClick: (filePath: string) => void;
  onFileSelect?: (filePath: string | null) => void;
  selectedFile?: string | null;
}

export function DirectoryContents({ content, onDirectoryClick, onFileSelect, selectedFile }: Props) {
  const handleFileOpen = async (path: string) => {
    try {
      await openFile(path);
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  if (content.length === 0) {
    return (
      <div className="flex justify-center items-center h-24 text-gray-500 text-lg">
        <p>There are no files in this directory.</p>
      </div>
    );
  }

  return (
    <div className="p-2 overflow-auto">
      <table className="min-w-[60%] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-2 px-3">Name</th>
            <th className="py-2 px-3 w-32">Size</th>
            <th className="py-2 px-3 w-40">Date</th>
          </tr>
        </thead>
        <tbody>
          {content.map((item, idx) => {
        // normalize different possible shapes coming from backend or state
        // possible shapes:
        // { type: 'file' | 'directory', meta: { name, path, is_dir, ... } }
        // { File: { name, path, is_dir, ... } } or { Directory: { ... } }
        // or legacy DirectoryContent keyed object
        let meta: any = null;
        let isDir = false;

        if (item == null) return null;

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
          // fallback: try to find first nested object with path
          const candidate = (Object.values(item) as any[]).find((v: any) => v && typeof v.path === 'string');
          meta = candidate || { name: JSON.stringify(item), path: '', is_dir: false };
          isDir = meta.is_dir || false;
        }

        const path = meta?.path || '';

        return (
              <tr
                key={idx}
                role="row"
                aria-selected={selectedFile === meta.path}
                onClick={(e) => {
                  e.stopPropagation();
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
                className={`cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${selectedFile === path ? 'bg-blue-50' : ''}`}
              >
                <td className="py-2 px-3 align-top">
                  <div className="flex items-center gap-3">
                    <span className={`flex-shrink-0 text-2xl font-bold w-6 text-center ${isDir ? 'text-blue-500' : 'text-gray-400'}`}>
                      {isDir ? '📁' : '📄'}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${selectedFile === path ? 'bg-blue-100 text-blue-800 px-1 rounded' : 'text-gray-800'}`}>
                        {meta.name}
                      </div>
                      {/* <div className="text-xs text-gray-400 truncate">
                        {meta.modified ? formatDate(meta.modified) : meta.created ? formatDate(meta.created) : ''}
                      </div> */}
                    </div>
                  </div>
                </td>

                <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">
                  {isDir ? 'Folder' : formatBytes(meta.size)}
                </td>

                <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">
                  {meta.modified ? formatDate(meta.modified) : meta.created ? formatDate(meta.created) : ''}
                </td>
              </tr>
        );
            })} 
          </tbody>
        </table>
      </div>
  );
}