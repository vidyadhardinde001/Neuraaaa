/**
 * DirectoryEntity Component
 *
 * Renders a single file/folder (with icon, size, modified date).
 * - Handles selection (click highlights item).
 * - Handles navigation (double-click → open directory or file).
 * - Handles right-click (context menu with actions).
 * - Highlights selected entity in UI.
 * - Supports drag and drop functionality.
 *
 * Dependencies (communicates with):
 * - ../../types → ContextMenuType, DirectoryContentType, DirectoryEntityType
 * - ../../state/hooks → Redux hooks (dispatch/select)
 * - ../../state/slices/contextMenuSlice → updateContextMenu, DirectoryEntityContextPayload
 * - ../../state/slices/currentDirectorySlice → selectContentIdx, unselectDirectoryContents, selectCurrentSelectedContentIdx
 * - FontAwesome (react-fontawesome) → for file/folder icons
 *
 * If modified, also check:
 * - contextMenuSlice.ts (if context menu payload structure changes)
 * - currentDirectorySlice.ts (if selection logic changes)
 * - ContextMenus.tsx (since it renders DirectoryEntity context menus)
 * - DirectoryContents.tsx (parent list that uses this component)
 */


import { MouseEvent, MouseEventHandler, useRef, useState } from "react";
import { ContextMenuType, DirectoryContentType, DirectoryEntityType } from "../../types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faFolder, faFileAlt, faFileImage, faFilePdf, faFileAudio, faFileVideo, faFileCode, faFileArchive } from "@fortawesome/free-solid-svg-icons";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { DirectoryEntityContextPayload, updateContextMenu } from "../../state/slices/contextMenuSlice";
import {
    selectContentIdx,
    selectCurrentSelectedContentIdx,
    unselectDirectoryContents
} from "../../state/slices/currentDirectorySlice";

interface Props {
    name: string;
    path: string;
    type: DirectoryContentType;
    onDoubleClick: MouseEventHandler<HTMLButtonElement>;
    idx: number;
    size?: number;
    modified?: string;
}

export const DIRECTORY_ENTITY_ID = "directory-entity";

// Helper function to get appropriate icon based on file extension
const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
        case 'pdf':
            return faFilePdf;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
        case 'svg':
            return faFileImage;
        case 'mp3':
        case 'wav':
        case 'flac':
        case 'aac':
            return faFileAudio;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
        case 'mkv':
            return faFileVideo;
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'html':
        case 'css':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
        case 'cs':
        case 'php':
        case 'rb':
        case 'go':
        case 'rs':
            return faFileCode;
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz':
        case '7z':
            return faFileArchive;
        case 'txt':
        case 'md':
        case 'rtf':
            return faFileAlt;
        default:
            return faFile;
    }
};

// Helper function to format file size
const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to format date
const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

export default function DirectoryEntity({ idx, name, path, type, onDoubleClick, size, modified }: Props) {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const dispatch = useAppDispatch();
    const selectedContentIdx = useAppSelector(selectCurrentSelectedContentIdx);
    const isSelected = selectedContentIdx === idx;
    const [isDragging, setIsDragging] = useState(false);

    function handleContextMenu(e: MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();

        dispatch(updateContextMenu({
            currentContextMenu: ContextMenuType.DirectoryEntity,
            mouseX: e.pageX,
            mouseY: e.pageY,
            contextMenuPayload: { fileName: name, filePath: path, type } as DirectoryEntityContextPayload,
        }));
    }

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsDragging(true);
        // Store the file/folder path and name in dataTransfer
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-file-path', path);
        e.dataTransfer.setData('application/x-file-name', name);
        e.dataTransfer.setData('application/x-file-type', type);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const icon = type === "Directory" ? faFolder : getFileIcon(name);
    const iconColor = type === "Directory" ? "#FFD54F" : "#9CA3AF";

    return (
        <div 
            title={`${name}${size ? ` (${formatFileSize(size)})` : ''}`}
            className={`group relative rounded-lg transition-all duration-200 ${
                isSelected 
                    ? 'bg-blue-100 ring-2 ring-blue-300' 
                    : 'hover:bg-gray-50'
            }`}
        >
            <button
                id={DIRECTORY_ENTITY_ID}
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onContextMenu={handleContextMenu}
                className={`w-full p-3 flex items-center space-x-3 rounded-lg transition-all duration-200 ${
                    isDragging
                        ? 'opacity-50 bg-blue-200'
                        : isSelected 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-move`}
                onDoubleClick={(e) => {
                    onDoubleClick(e);
                    dispatch(unselectDirectoryContents());
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    dispatch(selectContentIdx(idx));
                }}
                ref={buttonRef}
            >
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    type === "Directory" 
                        ? 'bg-yellow-100 group-hover:bg-yellow-200' 
                        : 'bg-gray-100 group-hover:bg-gray-200'
                } transition-colors duration-200`}>
                    <FontAwesomeIcon 
                        icon={icon} 
                        size="lg" 
                        color={iconColor}
                        className="transition-transform duration-200 group-hover:scale-110"
                    />
                </div>

                {/* File/Folder Info */}
                <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">
                        {name}
                    </div>
                    {(size || modified) && (
                        <div className="text-xs text-gray-500 space-y-0.5">
                            {size && (
                                <div>{formatFileSize(size)}</div>
                            )}
                            {modified && (
                                <div>{formatDate(modified)}</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                )}
            </button>

            {/* Hover effect overlay */}
            <div className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-200 ${
                isDragging
                    ? 'ring-2 ring-blue-400'
                    : isSelected 
                    ? 'ring-2 ring-blue-400' 
                    : 'group-hover:ring-1 group-hover:ring-gray-200'
            }`}></div>
        </div>
    );
}