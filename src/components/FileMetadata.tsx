import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatBytes, formatDate } from "../lib/utils";
import { FileText, Copy, MoreVertical } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileMetadataProps {
  filePath: string | null;
}

interface FileMetadataInfo {
  name: string;
  type: string;
  size: number;
  location: string;
  modified: string;
  created?: string;
  accessed?: string;
  dimensions?: string; // For images: "1024 x 768"
  extension: string;
  isDirectory: boolean;
}

async function getFileMetadata(filePath: string): Promise<FileMetadataInfo | null> {
  try {
    const metadata = await invoke<any>("metadata_for_path", { path: filePath });
    
    const pathParts = filePath.split(/[\\\/]/);
    const fileName = pathParts[pathParts.length - 1];
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
    
    // Determine file type
    const typeMap: { [key: string]: string } = {
      txt: "Text File",
      md: "Markdown File",
      json: "JSON File",
      pdf: "PDF Document",
      jpg: "JPEG Image",
      jpeg: "JPEG Image",
      png: "PNG Image",
      gif: "GIF Image",
      webp: "WebP Image",
      mp4: "MP4 Video",
      mp3: "MP3 Audio",
      wav: "WAV Audio",
      zip: "ZIP Archive",
      rar: "RAR Archive",
      exe: "Application",
      dll: "System Library",
      doc: "Word Document",
      docx: "Word Document",
      xls: "Excel Spreadsheet",
      xlsx: "Excel Spreadsheet",
    };
    
    const fileType = typeMap[fileExtension] || `${fileExtension.toUpperCase()} File`;
    
    // Extract directory path
    const locationParts = filePath.split(/[\\\/]/);
    locationParts.pop();
    const location = locationParts.join("\\");
    
    return {
      name: fileName,
      type: fileType,
      size: metadata.size || 0,
      location: location || "C:\\",
      modified: metadata.modified || new Date().toISOString(),
      created: metadata.created,
      accessed: metadata.accessed,
      extension: fileExtension,
      isDirectory: metadata.is_dir || false,
      dimensions: metadata.dimensions, // For images
    };
  } catch (err) {
    console.error("Failed to get file metadata:", err);
    return null;
  }
}

export default function FileMetadata({ filePath }: FileMetadataProps) {
  const [metadata, setMetadata] = useState<FileMetadataInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setMetadata(null);
      setThumbnail(null);
      return;
    }

    setLoading(true);
    
    getFileMetadata(filePath)
      .then((data) => {
        setMetadata(data);
        
        // Try to load thumbnail for images
        if (data && ["jpg", "jpeg", "png", "gif", "webp"].includes(data.extension)) {
          invoke<[string, string]>("preview_binary_file", { path: filePath })
            .then(([b64]) => {
              try {
                const byteCharacters = atob(b64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: `image/${data.extension}` });
                const url = URL.createObjectURL(blob);
                setThumbnail(url);
              } catch (err) {
                console.error("Failed to create thumbnail:", err);
              }
            })
            .catch(() => {});
        }
      })
      .finally(() => setLoading(false));

    return () => {
      if (thumbnail) {
        try {
          URL.revokeObjectURL(thumbnail);
        } catch (_) {}
      }
    };
  }, [filePath]);

  if (!filePath || !metadata) {
    return (
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500 py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a file to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* File Name */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate break-all">{metadata.name}</p>
            <p className="text-xs text-gray-500 mt-1">{metadata.type}</p>
          </div>
        </div>

        {/* Share Button */}
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 mb-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition">
          <Copy className="w-4 h-4" />
          Copy Path
        </button>
      </div>

      {/* Details Section */}
      <div className="border-t border-gray-200 px-4 py-4">
        <h4 className="text-xs font-bold text-gray-700 uppercase mb-3">Details</h4>
        
        <div className="space-y-3">
          {/* Type */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-600 font-medium">Type</span>
            <span className="text-xs text-gray-800 text-right flex-1 ml-2">{metadata.type}</span>
          </div>

          {/* Size */}
          {!metadata.isDirectory && (
            <div className="flex justify-between items-start">
              <span className="text-xs text-gray-600 font-medium">Size</span>
              <span className="text-xs text-gray-800 text-right flex-1 ml-2">{formatBytes(metadata.size)}</span>
            </div>
          )}

          {/* Location */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-600 font-medium">File location</span>
            <span 
              className="text-xs text-blue-600 text-right flex-1 ml-2 truncate hover:cursor-pointer hover:underline"
              title={metadata.location}
            >
              {metadata.location}
            </span>
          </div>

          {/* Date Modified */}
          <div className="flex justify-between items-start">
            <span className="text-xs text-gray-600 font-medium">Date modified</span>
            <span className="text-xs text-gray-800 text-right flex-1 ml-2">{formatDate(metadata.modified)}</span>
          </div>

          {/* Date Created */}
          {metadata.created && (
            <div className="flex justify-between items-start">
              <span className="text-xs text-gray-600 font-medium">Date created</span>
              <span className="text-xs text-gray-800 text-right flex-1 ml-2">{formatDate(metadata.created)}</span>
            </div>
          )}

          {/* Date Accessed */}
          {metadata.accessed && (
            <div className="flex justify-between items-start">
              <span className="text-xs text-gray-600 font-medium">Date accessed</span>
              <span className="text-xs text-gray-800 text-right flex-1 ml-2">{formatDate(metadata.accessed)}</span>
            </div>
          )}

          {/* Dimensions (for images) */}
          {metadata.dimensions && (
            <div className="flex justify-between items-start">
              <span className="text-xs text-gray-600 font-medium">Dimensions</span>
              <span className="text-xs text-gray-800 text-right flex-1 ml-2">{metadata.dimensions}</span>
            </div>
          )}
        </div>
      </div>

      {/* Properties Button */}
      <div className="border-t border-gray-200 px-4 py-3">
        <button 
          onClick={() => {
            // Open properties dialog or window
            console.log("Opening properties for:", filePath);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition"
        >
          ⚙️ Properties
        </button>
      </div>
    </div>
  );
}
