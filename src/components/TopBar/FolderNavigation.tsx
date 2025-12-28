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
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import SettingsModal from "../SettingsModal";
import { parseVoiceCommand, findFileInList } from "../../utils/voiceCommandParser";
import Toast from "../Toast";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Input, { InputSize } from "../../ui/Input";

export interface Props {
    onBackArrowClick: () => void;
    canGoBackward: boolean;
    onForwardArrowClick: () => void;
    canGoForward: boolean;
    onRefresh: () => Promise<void>;
    currentDirectoryPath?: string;
    currentVolume?: string;
    setSearchResults?: Dispatch<SetStateAction<any[]>>;
}

export default function FolderNavigation({ onBackArrowClick, canGoBackward, onForwardArrowClick, canGoForward, onRefresh, currentDirectoryPath, currentVolume, setSearchResults }: Props & { currentDirectoryPath?: string, currentVolume?: string, setSearchResults?: Dispatch<SetStateAction<any[]>> }) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newFileShown, setNewFileShown] = useState(false);
    const [newFolderShown, setNewFolderShown] = useState(false);
    const [renameShown, setRenameShown] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");

    // compact search state (merged into nav)
    const [searchValue, setSearchValue] = useState("");
    const [directoryInput, setDirectoryInput] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [results, setResults] = useState<any[]>([]);
    const [resultCount, setResultCount] = useState(0);
    const [scannedCount, setScannedCount] = useState<number>(0);
    const [matchedCount, setMatchedCount] = useState<number>(0);
    const [countsByType, setCountsByType] = useState<Record<string, number>>({});
    const [countsByExtension, setCountsByExtension] = useState<Record<string, number>>({});

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

    // Search functions (compact version integrated into nav)
    useEffect(() => {
        // noop cleanup placeholder
        return () => { };
    }, []);

    async function onSearch() {
        if (!currentVolume) {
            alert("Please select a volume before searching.");
            return;
        }

        if (isSearching) {
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setSearchResults?.([]);
        setResults([]);
        setResultCount(0);
        setElapsedTime(0);
        setScannedCount(0);
        setMatchedCount(0);
        setCountsByType({});
        setCountsByExtension({});

        const unlistenResults = await listen<any>("search_result", (event) => {
            const payload = event.payload?.child ?? event.payload;
            setResults((prev) => {
                const newArr = prev ? [...prev] : [];
                // insert or push; keep simple push for compact mode
                newArr.push(payload);
                setResultCount(newArr.length);
                setSearchResults?.(newArr);
                return newArr;
            });
        });

        const unlistenFinished = await listen<any>("search_finished", (event) => {
            const payload = event.payload as any;
            if (typeof payload === 'number') {
                setElapsedTime(payload);
            } else if (payload && typeof payload === 'object') {
                setElapsedTime(payload.elapsed_ms ?? 0);
                setScannedCount(payload.scanned ?? 0);
                setMatchedCount(payload.matched ?? 0);
                setCountsByType(payload.counts_by_type ?? {});
                setCountsByExtension(payload.counts_by_extension ?? {});
            }

            setIsSearching(false);
            try { unlistenResults(); } catch { }
            try { unlistenFinished(); } catch { }
            try { unlistenProgress(); } catch { }
        });

        // listen for progress updates
        const unlistenProgress = await listen<any>("search_progress", (event) => {
            const p = event.payload as any;
            setScannedCount(p.scanned ?? scannedCount);
            setMatchedCount(p.matched ?? matchedCount);
            setCountsByType(p.counts_by_type ?? countsByType);
            setCountsByExtension(p.counts_by_extension ?? countsByExtension);
        });

        try {
            await invoke("search_directory", {
                query: searchValue,
                searchDirectory: currentDirectoryPath,
                mountPnt: currentVolume,
                extension: "",
                acceptFiles: true,
                acceptDirectories: true,
            });
        } catch (error) {
            console.error("Search error:", error);
            setIsSearching(false);
            try { unlistenResults(); } catch { }
            try { unlistenFinished(); } catch { }
            try { unlistenProgress(); } catch { }
        }
    }

    return (
        // sticky header — keeps navigation always visible while scrolling
        <div className="sticky top-4 z-40 w-full">
            <div onClick={(e) => e.stopPropagation()} className="flex justify-start items-center mb-5 w-full bg-white/80 backdrop-blur-sm dark:bg-black/70 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center w-full gap-3">

                    {/* Back button */}
                        <button
                            onClick={onBackArrowClick}
                            disabled={!canGoBackward}
                            className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} size="sm" />
                        </button>

                        {/* Forward button */}
                        <button
                            onClick={onForwardArrowClick}
                            disabled={!canGoForward}
                            className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <FontAwesomeIcon icon={faArrowRight} size="sm" />
                        </button>
                    {/* Left: compact search input */}
                    <div className="flex-1">
                        <Input
                            value={searchValue}
                            setValue={setSearchValue}
                            placeholder={`Search files and folders...`}
                            className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            onSubmit={onSearch}
                            size={InputSize.Large}
                        />

                    </div>

                    <button
                        onClick={onSearch}
                        disabled={!searchValue.trim() && !isSearching}
                        className={`px-4 py-4 rounded-full text-sm font-medium flex items-center gap-2 transition shadow-sm
    ${isSearching
                                ? 'bg-orange-500 text-white'
                                : searchValue.trim()
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m2.2-4.8a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {isSearching ? '' : '   '}
                    </button>

                    {/* Center: navigation controls */}
                    <div className="flex items-center space-x-2">
                        

                        {/* Settings */}
                        <button onClick={() => setShowSettings(true)} className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300">⚙</button>

                        {/* New file/folder / rename / delete */}
                        <button onClick={() => setNewFileShown(true)} title="New File" className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"><Plus className="w-4 h-4" /></button>
                        <button onClick={() => setNewFolderShown(true)} title="New Folder" className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"><FolderPlus className="w-4 h-4" /></button>
                        <button onClick={() => setRenameShown(true)} title="Rename selected" disabled={selectedIdx === undefined} className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={async () => {
                            if (selectedIdx === undefined) return;
                            const sel = contents[selectedIdx];
                            if (!sel) return;
                            const meta = (sel as any).meta || (sel as any).File || (sel as any).Directory || (() => null)();
                            const path = meta?.path;
                            if (!path) return alert('Selected item has no path');
                            const ok = confirm(`Are you sure you want to delete ${meta.name}?`);
                            if (!ok) return;
                            try { await deleteFile(path); dispatch(deleteContent(sel)); dispatch(unselectDirectoryContents()); await onRefresh(); } catch (e) { alert(String(e)); }
                        }} title="Delete selected" disabled={selectedIdx === undefined} className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>

                        {/* Voice */}
                        <VoiceInput onCommandReceived={handleVoiceCommand} />
                    </div>

                    {/* Right: directory input and search action */}
                  
                </div>
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

                {/* Small floating stats window (right side) — visible only when a volume is selected */}
                {currentVolume && currentVolume !== "" && (
                    <div className="fixed top-[100px] right-0 m-3 mt-3 w-[300px] p-2 bg-white border border-gray-200 rounded shadow-md text-xs z-50">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-gray-700">Search</div>
                            <div className={`text-xs ${isSearching ? 'text-orange-500' : 'text-gray-400'}`}>
                                {isSearching ? 'running' : 'last'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div className="text-[11px] text-gray-500">Query time</div>
                            <div className="text-blue-400 font-medium text-sm">{elapsedTime > 0 ? (elapsedTime / 1000).toFixed(2) + 's' : '—'}</div>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div className="text-[11px] text-gray-500">Files scanned</div>
                            <div className="text-blue-400 font-medium text-sm">{scannedCount}</div>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div className="text-[11px] text-gray-500">Matches</div>
                            <div className=" text-blue-400 font-medium text-sm">{matchedCount}</div>
                        </div>

                        {/* small breakdown by type (file / directory) — keep it compact */}
                        {Object.keys(countsByType).length > 0 && (
                            <div className="mt-2 text-[11px] text-gray-500 border-t pt-2">
                                <div className="font-medium text-[11px] text-gray-700 mb-1">By type</div>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(countsByType).map(([t, c]) => (
                                        <div key={t} className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-700">
                                            {t}: {c}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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