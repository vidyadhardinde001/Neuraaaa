import React, { useState } from "react";

interface DragDropZoneProps {
  onFilesDropped?: (files: string[]) => void;
  children?: React.ReactNode;
  className?: string;
}

export function DragDropZone({
  onFilesDropped,
  children,
  className = "",
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const filePaths: string[] = [];

      // For web-based drag and drop, we need to handle files from the system
      // This is a limitation of web APIs - we can't directly access file system paths
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Store file info for potential processing
        filePaths.push(file.name);
      }

      if (onFilesDropped) {
        onFilesDropped(filePaths);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${className} ${
        isDragging
          ? "bg-blue-50 border-2 border-blue-400 border-dashed"
          : "border-2 border-transparent"
      } transition`}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-lg pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">Drop files here</p>
            <p className="text-sm text-blue-500">to copy or move them</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

interface FileDragPreviewProps {
  fileName: string;
  fileSize?: number;
  isDragging: boolean;
}

export function FileDragPreview({
  fileName,
  fileSize,
  isDragging,
}: FileDragPreviewProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div
      draggable
      className={`p-3 rounded-lg cursor-move transition ${
        isDragging
          ? "bg-blue-100 border-2 border-blue-400 shadow-lg"
          : "bg-gray-100 border border-gray-300 hover:bg-gray-150"
      }`}
    >
      <p className="font-medium text-sm text-gray-800 truncate">{fileName}</p>
      {fileSize !== undefined && (
        <p className="text-xs text-gray-500">{formatFileSize(fileSize)}</p>
      )}
    </div>
  );
}
