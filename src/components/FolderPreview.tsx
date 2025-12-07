import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, File } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

interface FolderPreviewProps {
  folderPath: string;
}

const FolderPreview: React.FC<FolderPreviewProps> = ({ folderPath }) => {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!folderPath) return;
    invoke<FileNode>("read_dir_recursive", { path: folderPath })
      .then(setTree)
      .catch(console.error);
  }, [folderPath]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderTree = (node: FileNode) => (
    <li key={node.path} className="my-1">
      <div
        onClick={() => node.is_dir && toggleExpand(node.path)}
        className={`flex items-center gap-2 cursor-pointer select-none ${
          node.is_dir ? "text-blue-700 font-medium" : "text-gray-700"
        }`}
      >
        {node.is_dir ? (
          <Folder
            size={16}
            className={`transition-transform ${
              expanded.has(node.path) ? "rotate-90" : ""
            }`}
          />
        ) : (
          <File size={16} />
        )}
        {node.name}
      </div>

      {node.is_dir && node.children && expanded.has(node.path) && (
        <ul className="ml-4 border-l border-gray-300 pl-3">
          {node.children.map(renderTree)}
        </ul>
      )}
    </li>
  );

  if (!tree)
    return (
      <div className="p-4 text-gray-400 text-sm italic">
        Loading folder contents...
      </div>
    );

  return (
    <div className="p-3 bg-gray-50 rounded-xl shadow-inner h-full overflow-auto">
      <h2 className="text-base font-semibold mb-2 text-gray-700">
        📁 Folder Preview: {tree.name}
      </h2>
      <ul>{renderTree(tree)}</ul>
    </div>
  );
};

export default FolderPreview;
