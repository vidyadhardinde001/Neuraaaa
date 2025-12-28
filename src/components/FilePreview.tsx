import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatBytes, formatDate } from "../lib/utils";
import { Move, GripVertical, X, Minus, Square } from "lucide-react";



interface FilePreviewProps {
  file: string | null;
}

export default function FilePreview({ file }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ size?: number | null; modified?: string | null } | null>(null);

  // Window state
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 870, y: 370 });
  const [size, setSize] = useState({ width: 60, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!file) {
      setContent(null);
      setError(null);
      setLoading(false);
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) { }
        setObjectUrl(null);
      }
      return;
    }

    const ext = file.split(".").pop()?.toLowerCase();

    setLoading(true);
    setContent(null);
    setError(null);
    setMeta(null);

    // request metadata early for every file so UI can show size/date
    try {
      invoke<any>('metadata_for_path', { path: file }).then((m) => setMeta(m)).catch(() => { });
    } catch (_) { }

    if (["txt", "md", "json", "js", "ts", "java", "py"].includes(ext || "")) {
      invoke<string>("preview_text_file", { path: file })
        .then((res) => setContent(res))
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    } else {
      // ask backend to return base64 and mime for binary files
      invoke<[string, string]>("preview_binary_file", { path: file })
        .then(([b64, mime]) => {
          try {
            const byteCharacters = atob(b64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mime });
            const url = URL.createObjectURL(blob);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setObjectUrl(url);
          } catch (err) {
            setError(String(err));
          } finally {
            setLoading(false);
          }
        })
        .catch((err) => {
          setError(String(err));
          setLoading(false);
        });
    }
  }, [file]);

  // cleanup object URLs when objectUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) { }
      }
    };
  }, [objectUrl]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.no-drag')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(400, e.clientX - position.x);
      const newHeight = Math.max(300, e.clientY - position.y);
      setSize({
        width: newWidth,
        height: newHeight
      });
    }
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
  };

  // Event listeners for drag and resize
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
      document.addEventListener('mouseup', isDragging ? handleMouseUp : handleResizeMouseUp);

      return () => {
        document.removeEventListener('mousemove', isDragging ? handleMouseMove : handleResizeMouseMove);
        document.removeEventListener('mouseup', isDragging ? handleMouseUp : handleResizeMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, position]);

  // Window controls
  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (!isMaximized) {
      // Store current size and position before maximizing
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 40 });
      setPosition({ x: 20, y: 20 });
    }
  };

  const handleClose = () => {
    setContent(null);
    setError(null);
    setObjectUrl(null);
    setMeta(null);
  };

  if (!file) return <div className="text-gray-400">No file selected</div>;

  const ext = file.split(".").pop()?.toLowerCase();

  // For binary previews (image, pdf, video, audio) read the file via Tauri FS and render as object URL
  const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
  const videoExts = ["mp4", "webm", "mov"];
  const audioExts = ["mp3", "wav", "ogg"];

  // If we already have an object URL for this file, render it
  const renderPreviewContent = () => {
    if (objectUrl) {
      if (imageExts.includes(ext || "")) {
        return (
          <div className="flex items-center justify-center h-full p-4">
            <img
              src={objectUrl}
              className="max-h-full max-w-full rounded-lg shadow-lg object-contain"
              alt="Preview"
            />
          </div>
        );
      }

      if (ext === "pdf") {
        return (
          <iframe
            src={objectUrl}
            className="w-full h-full border-0 rounded-lg"
            title="PDF Preview"
          />
        );
      }

      if (videoExts.includes(ext || "")) {
        return (
          <div className="flex items-center justify-center h-full p-4">
            <video
              src={objectUrl}
              className="max-h-full max-w-full rounded-lg"
              controls
              autoPlay
              muted
            />
          </div>
        );
      }

      if (audioExts.includes(ext || "")) {
        return (
          <div className="flex items-center justify-center h-full p-4">
            <audio src={objectUrl} controls className="w-full max-w-md" />
          </div>
        );
      }
    }

    // Text/Code preview
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <div>Loading preview...</div>
          </div>
        </div>
      );
    }

    if (content) {
      if (["md"].includes(ext || "")) {
        return (
          <div className="h-full overflow-auto p-4 bg-white">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );
      } else {
        return (
          <div className="h-full overflow-auto">
            <SyntaxHighlighter
              language={ext}
              style={oneDark}
              customStyle={{
                margin: 0,
                height: '100%',
                borderRadius: '0.5rem'
              }}
            >
              {content}
            </SyntaxHighlighter>
          </div>
        );
      }
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-500">
          ⚠ {error}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No preview available
      </div>
    );
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bg-white border border-gray-300 rounded-lg shadow-lg cursor-move z-50"
        style={{
          left: position.x,
          top: position.y,
          width: '300px',
          height: '40px'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between h-full px-3">
          <div className="flex items-center space-x-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium truncate">
              {file.split(/[\\/]/).pop()}
            </span>
          </div>
          <button
            onClick={handleMinimize}
            className="no-drag p-1 hover:bg-gray-100 rounded"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bg-white border border-gray-300 rounded-lg shadow-xl cursor-move z-50 flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: isMaximized ? 'calc(100vw - 40px)' : size.width,
        height: isMaximized ? 'calc(100vh - 40px)' : size.height,
        minWidth: '290px',
        minHeight: '400px'
      }}
      onMouseDown={(e) => {
        e.stopPropagation(); // 🧱 Prevent background click clearing file
        handleMouseDown(e);
      }}
      onClick={(e) => e.stopPropagation()} // 🧱 Also block normal clicks
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Move className="w-4 h-4 text-gray-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">
              Preview: {file.split(/[\\/]/).pop()}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {file}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 no-drag">
          <button
            onClick={handleMinimize}
            className="p-1.5 bg-gray-200 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1.5 bg-gray-200 rounded transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-red-600 rounded transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* File info bar */}
      <div className="px-4 py-1.5 bg-white border-b border-gray-100 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span className="truncate flex-1 mr-4">{file}</span>
          {meta && (
            <span className="whitespace-nowrap">
              {meta.size ? formatBytes(meta.size) : ''}
              {meta.modified ? ' • ' + new Date(meta.modified).toLocaleString() : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-gray-50 rounded-b-lg">
        {renderPreviewContent()}
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-200 hover:bg-blue-200 rounded-tl-lg"
          onMouseDown={handleResizeMouseDown}
          title="Resize"
        >
          <div className="w-full h-full flex items-end justify-end">
            <GripVertical className="w-3 h-3 transform rotate-45 text-gray-500" />
          </div>
        </div>
      )}
    </div>
  );
}