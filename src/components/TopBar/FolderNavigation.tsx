/**
 * FolderNavigation Component
 *
 * Provides back, forward, and refresh buttons for folder navigation.
 *
 * Communicates with:
 * - Parent explorer component → Provides navigation functions and state:
 *   - onBackArrowClick
 *   - onForwardArrowClick
 *   - onRefresh
 *
 * If modified, also check:
 * - Parent component (navigation history + refresh logic lives there)
 */



import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { Plus, FolderPlus, Edit3, Trash2 } from "lucide-react";
import InputModal from "../InputModal";
import VoiceInput from "../VoiceInput";
import { createDirectoryContent, removeFileNameFromPath } from "../../util";
import { unselectDirectoryContents } from "../../state/slices/currentDirectorySlice";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { selectDirectoryContents, selectCurrentSelectedContentIdx, addContent, deleteContent, renameContent, selectContentIdx } from "../../state/slices/currentDirectorySlice";
import { createFile, createDirectory, renameFile, deleteFile } from "../../ipc";
import { useState } from "react";
import SettingsModal from "../SettingsModal";
import { parseVoiceCommand, findFileInList } from "../../utils/voiceCommandParser";
import Toast from "../Toast";

export interface Props {
    onBackArrowClick: () => void;
    canGoBackward: boolean;
    onForwardArrowClick: () => void;
    canGoForward: boolean;
    onRefresh: () => Promise<void>;
    currentDirectoryPath?: string;
}

export default function FolderNavigation({ onBackArrowClick, canGoBackward, onForwardArrowClick, canGoForward, onRefresh, currentDirectoryPath }: Props & { currentDirectoryPath?: string }) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newFileShown, setNewFileShown] = useState(false);
    const [newFolderShown, setNewFolderShown] = useState(false);
    const [renameShown, setRenameShown] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");

    const dispatch = useAppDispatch();
    const contents = useAppSelector(selectDirectoryContents);
    const selectedIdx = useAppSelector(selectCurrentSelectedContentIdx);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
    };

    // Handle voice commands
    const handleVoiceCommand = async (voiceInput: string) => {
        const parsed = parseVoiceCommand(voiceInput);

        try {
            if (parsed.action === 'unknown') {
                setToastMsg(parsed.error || "Unknown command");
                setToastType("error");
                return;
            }

            if (parsed.action === 'create_file') {
                if (!parsed.target) {
                    setToastMsg("Please specify a file name");
                    setToastType("error");
                    return;
                }
                const dir = currentDirectoryPath || "";
                const sep = dir && dir.includes("\\") ? "\\" : "/";
                const path = dir ? `${dir}${sep}${parsed.target}` : parsed.target;
                await createFile(path);
                const newContent = createDirectoryContent("File", parsed.target, path);
                dispatch(addContent(newContent));
                dispatch(selectContentIdx(0));
                setToastMsg(`File "${parsed.target}" created successfully`);
                setToastType("success");
                await onRefresh();
                return;
            }

            if (parsed.action === 'create_folder') {
                if (!parsed.target) {
                    setToastMsg("Please specify a folder name");
                    setToastType("error");
                    return;
                }
                const dir = currentDirectoryPath || "";
                const sep = dir && dir.includes("\\") ? "\\" : "/";
                const path = dir ? `${dir}${sep}${parsed.target}` : parsed.target;
                await createDirectory(path);
                const newContent = createDirectoryContent("Directory", parsed.target, path);
                dispatch(addContent(newContent));
                dispatch(selectContentIdx(0));
                setToastMsg(`Folder "${parsed.target}" created successfully`);
                setToastType("success");
                await onRefresh();
                return;
            }

            if (parsed.action === 'delete_file' || parsed.action === 'delete_folder') {
                if (!parsed.target) {
                    setToastMsg("Please specify a file or folder name");
                    setToastType("error");
                    return;
                }
                const found = findFileInList(parsed.target, contents);
                if (!found) {
                    setToastMsg(`Could not find "${parsed.target}" in current directory`);
                    setToastType("error");
                    return;
                }
                const meta = (found as any).meta || (found as any).File || (found as any).Directory || found;
                const path = meta?.path;
                if (!path) {
                    setToastMsg("Could not determine path to delete");
                    setToastType("error");
                    return;
                }
                await deleteFile(path);
                dispatch(deleteContent(found));
                dispatch(unselectDirectoryContents());
                setToastMsg(`"${meta.name}" deleted successfully`);
                setToastType("success");
                await onRefresh();
                return;
            }

            if (parsed.action === 'rename_file') {
                if (!parsed.target || !parsed.newName) {
                    setToastMsg("Please specify both old and new names");
                    setToastType("error");
                    return;
                }
                const found = findFileInList(parsed.target, contents);
                if (!found) {
                    setToastMsg(`Could not find "${parsed.target}" in current directory`);
                    setToastType("error");
                    return;
                }
                const meta = (found as any).meta || (found as any).File || (found as any).Directory || found;
                const oldPath = meta?.path;
                if (!oldPath) {
                    setToastMsg("Could not determine path to rename");
                    setToastType("error");
                    return;
                }
                const parent = removeFileNameFromPath(oldPath);
                const sep = oldPath.includes("\\") ? "\\" : "/";
                const newPath = parent ? `${parent}${sep}${parsed.newName}` : parsed.newName;
                await renameFile(oldPath, newPath);
                const oldContent = createDirectoryContent(
                    meta.is_dir ? "Directory" : "File",
                    meta.name,
                    oldPath
                );
                const newContent = createDirectoryContent(
                    meta.is_dir ? "Directory" : "File",
                    parsed.newName,
                    newPath
                );
                dispatch(renameContent([oldContent, newContent]));
                dispatch(selectContentIdx(0));
                setToastMsg(`Renamed to "${parsed.newName}"`);
                setToastType("success");
                await onRefresh();
                return;
            }
        } catch (e) {
            setToastMsg(`Error: ${String(e)}`);
            setToastType("error");
        }
    };

    return (
        // sticky header — keeps navigation always visible while scrolling
        <div className="sticky top-4 z-40 w-full">
            <div onClick={(e) => e.stopPropagation()} className="flex justify-start items-center mb-5 w-full bg-white/80 backdrop-blur-sm dark:bg-black/70 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex space-x-2">
                    {/* Back button */}
                    <button
                        onClick={onBackArrowClick}
                        disabled={!canGoBackward}
                        className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} size="sm" />
                    </button>

                    {/* Forward button */}
                    <button
                        onClick={onForwardArrowClick}
                        disabled={!canGoForward}
                        className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon icon={faArrowRight} size="sm" />
                    </button>

                    {/* Refresh button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 rounded-full transition-colors duration-200
                                bg-gray-200 text-gray-700
                                hover:bg-gray-300
                                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon
                            icon={faSyncAlt}
                            size="sm"
                            className={isRefreshing ? "animate-spin" : ""}
                        />
                    </button>

                    {/* Settings button */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                        ⚙
                    </button>
                    {/* New file */}
                    <button
                        onClick={() => setNewFileShown(true)}
                        title="New File"
                        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                        <Plus className="w-4 h-4" />
                    </button>

                    {/* New folder */}
                    <button
                        onClick={() => setNewFolderShown(true)}
                        title="New Folder"
                        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>

                    {/* Rename selected */}
                    <button
                        onClick={() => setRenameShown(true)}
                        title="Rename selected"
                        disabled={selectedIdx === undefined}
                        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete selected */}
                    <button
                        onClick={async () => {
                            if (selectedIdx === undefined) return;
                            const sel = contents[selectedIdx];
                            if (!sel) return;
                            // Resolve content object shape
                            const meta = (sel as any).meta || (sel as any).File || (sel as any).Directory || (() => null)();
                            const path = meta?.path;
                            if (!path) return alert('Selected item has no path');

                            const ok = confirm(`Are you sure you want to delete ${meta.name}?`);
                            if (!ok) return;

                            try {
                                await deleteFile(path);
                                dispatch(deleteContent(sel));
                                dispatch(unselectDirectoryContents());
                                // refresh view
                                await onRefresh();
                            } catch (e) {
                                alert(String(e));
                            }
                        }}
                        title="Delete selected"
                        disabled={selectedIdx === undefined}
                        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Voice input */}
                    <VoiceInput onCommandReceived={handleVoiceCommand} />
                </div>
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

                {/* New File Modal */}
                <InputModal
                    shown={newFileShown}
                    setShown={(s) => { setNewFileShown(s); setInputValue(""); }}
                    title="Create New File"
                    submitName="Create"
                    onSubmit={async (name) => {
                        if (!name || !name.trim()) return;
                        const dir = currentDirectoryPath || "";
                        const sep = dir && dir.includes("\\") ? "\\" : "/";
                        const path = dir ? `${dir}${sep}${name}` : name;
                        try {
                            await createFile(path);
                            const newDirectoryContent = createDirectoryContent("File", name, path);
                            dispatch(addContent(newDirectoryContent));
                            dispatch(selectContentIdx(0));
                            setNewFileShown(false);
                            await onRefresh();
                        } catch (e) {
                            alert(String(e));
                        }
                    }}
                />

                {/* New Folder Modal */}
                <InputModal
                    shown={newFolderShown}
                    setShown={(s) => { setNewFolderShown(s); setInputValue(""); }}
                    title="Create New Folder"
                    submitName="Create"
                    onSubmit={async (name) => {
                        if (!name || !name.trim()) return;
                        const dir = currentDirectoryPath || "";
                        const sep = dir && dir.includes("\\") ? "\\" : "/";
                        const path = dir ? `${dir}${sep}${name}` : name;
                        try {
                            await createDirectory(path);
                            const newDirectoryContent = createDirectoryContent("Directory", name, path);
                            dispatch(addContent(newDirectoryContent));
                            dispatch(selectContentIdx(0));
                            setNewFolderShown(false);
                            await onRefresh();
                        } catch (e) {
                            alert(String(e));
                        }
                    }}
                />

                {/* Rename Modal */}
                <InputModal
                    shown={renameShown}
                    setShown={(s) => { setRenameShown(s); setInputValue(""); }}
                    title="Rename"
                    submitName="Rename"
                    onSubmit={async (newName) => {
                        if (!newName || !newName.trim()) return;
                        if (selectedIdx === undefined) return alert('No item selected');
                        const sel = contents[selectedIdx];
                        const meta = (sel as any).meta || (sel as any).File || (sel as any).Directory || (sel as any);
                        const oldPath = meta?.path;
                        if (!oldPath) return alert('Selected item has no path');

                        try {
                            const parent = removeFileNameFromPath(oldPath);
                            const sep = oldPath.includes("\\") ? "\\" : "/";
                            const newPath = parent ? `${parent}${sep}${newName}` : newName;
                            await renameFile(oldPath, newPath);
                            const oldContent = createDirectoryContent(meta.is_dir ? "Directory" : "File", meta.name, oldPath);
                            const newContent = createDirectoryContent(meta.is_dir ? "Directory" : "File", newName, newPath);
                            dispatch(renameContent([oldContent, newContent]));
                            dispatch(selectContentIdx(0));
                            setRenameShown(false);
                            await onRefresh();
                        } catch (e) {
                            alert(String(e));
                        }
                    }}
                />
            </div>
            {toastMsg && (
                <Toast
                    message={toastMsg}
                    type={toastType}
                    onClose={() => setToastMsg("")}
                    duration={3000}
                />
            )}
        </div>
    );
}