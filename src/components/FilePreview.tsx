import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatBytes, formatDate } from "../lib/utils";

interface FilePreviewProps {
  file: string | null;
}

export default function FilePreview({ file }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ size?: number | null; modified?: string | null } | null>(null);

  useEffect(() => {
    if (!file) {
      setContent(null);
      setError(null);
      setLoading(false);
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
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
      invoke<any>('metadata_for_path', { path: file }).then((m) => setMeta(m)).catch(() => {});
    } catch (_) {}

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
        } catch (_) {}
      }
    };
  }, [objectUrl]);

  if (!file) return <div className="text-gray-400">No file selected</div>;

  const ext = file.split(".").pop()?.toLowerCase();

    // For binary previews (image, pdf, video, audio) read the file via Tauri FS and render as object URL
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
    const videoExts = ["mp4", "webm", "mov"];
    const audioExts = ["mp3", "wav", "ogg"];

    // If we already have an object URL for this file, render it
    if (objectUrl) {
      if (imageExts.includes(ext || "")) {
        return <img src={objectUrl} className="max-h-96 max-w-full rounded-lg shadow" />;
      }

      if (ext === "pdf") {
        return (
          <iframe src={objectUrl} className="w-full h-96 border rounded-lg" title="PDF Preview" />
        );
      }
      if (videoExts.includes(ext || "")) {
        return (
          <video
            src={objectUrl}
            className="w-full max-h-96 rounded-lg"
            autoPlay
            muted
            // we'll programmatically pause after 5s via onPlay handler attached below when mounted
            ref={(el) => {
              if (!el) return;
              // avoid reattaching multiple timers
              if ((el as any).__preview_timer_attached) return;
              (el as any).__preview_timer_attached = true;
              el.addEventListener('play', () => {
                setTimeout(() => {
                  try { el.pause(); el.controls = true; } catch(e) {}
                }, 5000);
              });
            }}
          />
        );
      }
      if (audioExts.includes(ext || "")) {
        return <audio src={objectUrl} controls className="w-full" />;
      }
    }

  // Text/Code preview
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">Previewing: {file ?? '—'}</div>

          <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
            <div className="truncate mr-4">Previewing: {file ?? '—'}</div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {meta ? `${meta.size ? formatBytes(meta.size) : ''}${meta.modified ? ' • ' + new Date(meta.modified).toLocaleString() : ''}` : ''}
            </div>
          </div>
      {loading ? (
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          <div>Loading preview...</div>
        </div>
      ) : objectUrl ? (
        // objectUrl render handled earlier by early return, but keep guard
        <div className="text-gray-500">Preview ready</div>
      ) : content ? (
        ["md"].includes(ext || "") ? (
          <div className="max-h-96 overflow-auto p-2 bg-gray-100 rounded">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="max-h-96 overflow-auto p-2 bg-gray-100 rounded">
            <SyntaxHighlighter language={ext} style={oneDark}>
              {content}
            </SyntaxHighlighter>
          </div>
        )
      ) : error ? (
        <div className="text-red-500">⚠ {error}</div>
      ) : (
        <div className="text-gray-500">No preview available</div>
      )}
    </div>
  );
}

// ...existing code above

// cleanup object URLs when component unmounts or objectUrl changes
// (useEffect with cleanup ensures revoke)
// Note: Not adding another useEffect earlier to keep changes minimal
