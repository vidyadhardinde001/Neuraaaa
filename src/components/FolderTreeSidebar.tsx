import React, { useState } from "react";
import { Folder, File, ChevronRight } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

interface FolderTreeSidebarProps {
  folderPath: string | null;
  folderName: string;
  treeData: FileNode | null;
  onFileSelect?: (filePath: string) => void;
  onFileOpen?: (filePath: string) => void;
}

export default function FolderTreeSidebar({
  folderPath,
  folderName,
  treeData,
  onFileSelect,
  onFileOpen,
}: FolderTreeSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: FileNode, level: number = 0, isLast: boolean = false) => {
    const isDir = node.is_dir;
    const isExpanded = expanded.has(node.path);
    const hasChildren = !!(isDir && node.children && node.children.length);

    return (
      <div key={node.path} className="relative">
        <div className="flex">
          {/* Tree lines column */}
          {level > 0 && (
            <div className="relative mr-1 flex flex-col items-stretch">
              {/* Vertical line */}
              <div
                className={`w-px flex-1 bg-gray-300 ${
                  isLast ? "rounded-b" : ""
                }`}
              />
              {/* Horizontal connector */}
              <div className="w-3 h-px bg-gray-300 -mt-3" />
            </div>
          )}

          {/* Row */}
          <div
            className={`flex-1 flex items-center gap-1.5 py-1.5 px-2 cursor-pointer hover:bg-blue-50 rounded transition-colors ${
              level === 0 ? "mb-1" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isDir) {
                toggleExpand(node.path);
              } else {
                onFileSelect?.(node.path);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isDir) {
                onFileOpen?.(node.path);
              }
            }}
          >
            {isDir ? (
              <>
                <ChevronRight
                  size={16}
                  className={`text-gray-600 flex-shrink-0 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <Folder size={16} className="text-blue-500 flex-shrink-0" />
              </>
            ) : (
              <>
                <div className="w-4" />
                <File size={16} className="text-gray-500 flex-shrink-0" />
              </>
            )}
            <span
              className={`text-sm truncate ${
                isDir ? "font-medium text-gray-800" : "text-gray-700"
              }`}
            >
              {node.name}
            </span>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-6">
            {node.children
              ?.slice()
              .sort((a, b) => {
                if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((child, idx, arr) =>
                renderNode(child, level + 1, idx === arr.length - 1)
              )}
          </div>
        )}
      </div>
    );
  };

  if (!folderPath) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 h-[calc(100vh-6.5rem)] mt-20 flex flex-col p-4 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          📁 Folder Tree
        </h2>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Select a folder to view its structure
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full mt-4 mr-4 flex flex-col overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 to-blue-100">
        <h2 className="text-sm font-semibold text-gray-800 truncate">
          📁 {folderName}
        </h2>
        <p className="text-xs text-gray-500 truncate mt-1">{folderPath}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-0">
        {treeData ? (
          <div className="space-y-2">
            {treeData.children && treeData.children.length > 0 ? (
              treeData.children
                .slice()
                .sort((a, b) => {
                  if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((node, idx, arr) => renderNode(node, 0, idx === arr.length - 1))
            ) : (
              <div className="text-sm text-gray-400 italic">Empty folder</div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
