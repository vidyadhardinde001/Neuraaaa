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
import { useAppSelector } from '../../state/hooks';
import { selectSettings } from '../../state/slices/settingsSlice';

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

  const settings = useAppSelector(selectSettings);

  // filter hidden files based on settings
  const filteredContent = settings.showHiddenFiles ? content : content.filter((c) => {
    try {
      const name = c?.meta?.name || c?.name || (c.File && c.File.name) || (c.Directory && c.Directory.name) || '';
      return !name.startsWith('.');
    } catch (e) {
      return true;
    }
  });

  if (filteredContent.length === 0) {
    return (
      <div className="flex justify-center items-center h-24 text-gray-500 text-lg">
        <p>There are no files in this directory.</p>
      </div>
    );
  }

  return (
    <div className="p-2 overflow-auto">
      {settings.viewMode === 'list' ? (
        <table className="min-w-[60%] text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 px-3">Name</th>
              {settings.columns.showSize && <th className="py-2 px-3 w-32">Size</th>}
              {settings.columns.showDate && <th className="py-2 px-3 w-40">Date</th>}
            </tr>
          </thead>
          <tbody>
            {filteredContent.map((item, idx) => {
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

            const displaySize = isDir ? 'Folder' : (settings.sizeFormat === 'decimal' ? formatBytes(meta.size, 'decimal') : formatBytes(meta.size, 'binary'));

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
                    </div>
                  </div>
                </td>

                {settings.columns.showSize && (
                  <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">
                    {displaySize}
                  </td>
                )}

                {settings.columns.showDate && (
                  <td className="py-2 px-3 align-top text-xs text-gray-500 whitespace-nowrap">
                    {meta.modified ? formatDate(meta.modified) : meta.created ? formatDate(meta.created) : ''}
                  </td>
                )}
              </tr>
            );
          })}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {filteredContent.map((item, idx) => {
            // reuse normalization code above
            let meta2: any = null;
            let isDir2 = false;

            if (item == null) return null;

            if (item.meta) {
              meta2 = item.meta;
              isDir2 = item.type === 'directory' || meta2.is_dir;
            } else if (item.File || item.Directory) {
              meta2 = item.File || item.Directory;
              isDir2 = !!item.Directory || meta2.is_dir;
            } else if (item.type && item.name && item.path) {
              meta2 = { name: item.name, path: item.path, is_dir: item.is_dir };
              isDir2 = item.type === 'directory' || item.is_dir;
            } else {
              const candidate = (Object.values(item) as any[]).find((v: any) => v && typeof v.path === 'string');
              meta2 = candidate || { name: JSON.stringify(item), path: '', is_dir: false };
              isDir2 = meta2.is_dir || false;
            }

            const path2 = meta2?.path || '';

            return (
              <div key={idx} className="p-3 bg-white rounded shadow-sm">
                <div className="text-sm font-medium truncate">{meta2.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {isDir2 ? 'Folder' : (settings.sizeFormat === 'decimal' ? formatBytes(meta2.size, 'decimal') : formatBytes(meta2.size, 'binary'))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}