import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {DirectoryContent, Volume} from "./types";
import DuplicateDetector from "./components/MainBody/DuplicateDetector";
import {openDirectory, openFile} from "./ipc";
import VolumeList from "./components/MainBody/Volumes/VolumeList";
import FolderNavigation from "./components/TopBar/FolderNavigation";
import {DirectoryContents} from "./components/MainBody/DirectoryContents";
import FilePreview from "./components/FilePreview";
import FileMetadata from "./components/FileMetadata";
import FolderTreeSidebar from "./components/FolderTreeSidebar";
import VaultTrigger from "./components/VaultTrigger";
import VaultModal from "./components/VaultModal";
import useNavigation from "./hooks/useNavigation";
import { TabBar } from "./components/TabBar";
import { DragDropZone } from "./components/DragDropZone";
// SearchBar merged into FolderNavigation
import {useAppDispatch, useAppSelector} from "./state/hooks";
import { selectSettings } from "./state/slices/settingsSlice";
import { selectActiveTab, updateTabPath } from "./state/slices/tabsSlice";
import useContextMenu from "./hooks/useContextMenu";
import ContextMenus from "./components/ContextMenus/ContextMenus";
import {
  selectDirectoryContents,
  unselectDirectoryContents,
  updateDirectoryContents
} from "./state/slices/currentDirectorySlice";
import {DIRECTORY_ENTITY_ID} from "./components/MainBody/DirectoryEntity";
import RecentFiles, { RecentFile } from "./components/RecentFiles";

const RECENT_FILES_STORAGE_KEY = "recentFiles";
const MAX_RECENT_FILES = 12;

function App() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const directoryContents = useAppSelector(selectDirectoryContents);
  const activeTab = useAppSelector(selectActiveTab);
  const dispatch = useAppDispatch();

  const [searchResults, setSearchResults] = useState<DirectoryContent[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFolderTree, setSelectedFolderTree] = useState<any>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const {
    pathHistory,
    setPathHistory,
    historyPlace,
    setHistoryPlace,
    onBackArrowClick,
    onForwardArrowClick,
    canGoBackward,
    canGoForward,
    currentVolume,
    setCurrentVolume,
  } = useNavigation(
    searchResults,
    setSearchResults,
    activeTab?.pathHistory || [],
    activeTab?.historyPlace || 0
  );

  async function getNewDirectoryContents() {
    const contents = await openDirectory(pathHistory[historyPlace]);
    dispatch(updateDirectoryContents(contents));
  }

  // Load recent files from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_FILES_STORAGE_KEY);
    if (stored) {
      try {
        setRecentFiles(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to load recent files:", err);
      }
    }
  }, []);

  // Save recent files to localStorage
  const saveRecentFile = async (filePath: string) => {
    try {
      const metadata = await invoke<any>("metadata_for_path", { path: filePath });
      const pathParts = filePath.split(/[\\\/]/);
      const fileName = pathParts[pathParts.length - 1];

      const newFile: RecentFile = {
        path: filePath,
        name: fileName,
        isDirectory: metadata.is_dir || false,
        openedAt: new Date().toISOString(),
        size: metadata.size,
      };

      // Remove duplicates (keep only the newest)
      let updated = recentFiles.filter(f => f.path !== filePath);
      updated = [newFile, ...updated].slice(0, MAX_RECENT_FILES);
      
      setRecentFiles(updated);
      localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to add recent file:", err);
    }
  };

  const clearRecentFiles = () => {
    setRecentFiles([]);
    localStorage.removeItem(RECENT_FILES_STORAGE_KEY);
  };

  // Handle folder selection for sidebar tree display
  async function handleFolderSelect(folderPath: string | null) {
    setSelectedFolder(folderPath);
    if (folderPath) {
      try {
        const tree = await invoke<any>("read_dir_recursive", { path: folderPath });
        setSelectedFolderTree(tree);
      } catch (err) {
        console.error("Failed to read folder tree:", err);
        setSelectedFolderTree(null);
      }
    } else {
      setSelectedFolderTree(null);
    }
  }

  async function onVolumeClick(mountpoint: string) {
    // Add to history if not already at this mountpoint
    let newHistory = [...pathHistory];
    if (newHistory[newHistory.length - 1] !== mountpoint) {
      newHistory.push(mountpoint);
    }
    
    const newPlace = newHistory.length - 1;
    
    // Update local state
    setPathHistory(newHistory);
    setHistoryPlace(newPlace);
    setCurrentVolume(mountpoint);

    // Update tab in Redux
    if (activeTab) {
      dispatch(updateTabPath({
        tabId: activeTab.id,
        path: mountpoint,
        pathHistory: newHistory,
        historyPlace: newPlace,
      }));
    }

    // Load directory contents
    try {
      const contents = await openDirectory(mountpoint);
      dispatch(updateDirectoryContents(contents));
    } catch (err) {
      console.error("Failed to load volume contents:", err);
    }
  }

  async function onDirectoryClick(filePath: string) {
    if (searchResults.length > 0) {
      setSearchResults([]);
    }
    
    // clear selected file when navigating into a directory
    setSelectedFile(null);
    
    // Create new history
    let newHistory = [...pathHistory];
    newHistory.push(filePath);
    const newPlace = newHistory.length - 1;
    
    // Update local state
    setPathHistory(newHistory);
    setHistoryPlace(newPlace);

    // Update tab in Redux
    if (activeTab) {
      dispatch(updateTabPath({
        tabId: activeTab.id,
        path: filePath,
        pathHistory: newHistory,
        historyPlace: newPlace,
      }));
    }

    // Load directory contents
    try {
      const contents = await openDirectory(filePath);
      dispatch(updateDirectoryContents(contents));
    } catch (err) {
      console.error("Failed to load directory contents:", err);
    }
  }

  async function getVolumes() {
    if (volumes.length > 0) {
      return;
    }

    try {
      if (!invoke) {
        console.error("Tauri invoke is not available");
        return;
      }
      const newVolumes = await invoke<Volume[]>("get_volumes");
      setVolumes(newVolumes);
    } catch (err) {
      console.error("Failed to get volumes:", err);
    }
  }
  

  let render = 0;

  useEffect(() => {
    if (render === 0) {
      getVolumes().catch(console.error);
    }

    render += 1; // I don't know why but the use effect runs twice causing the "get_volumes" to be called twice.
  }, [])

  useEffect(() => {
    if (pathHistory[historyPlace] == "") {
      setCurrentVolume("");
      return;
    }

    getNewDirectoryContents().catch((err) => {
      console.error("Failed to get directory contents:", err);
    });
  }, [historyPlace, pathHistory]);

  const [handleMainContextMenu, handleCloseContextMenu] = useContextMenu(dispatch, pathHistory[historyPlace]);

  // Listen for 'nav-back-forward' events and perform a back -> forward navigation to refresh view
  useEffect(() => {
    const onNavBackForward = async () => {
      try {
        // If we can go back then forward, do that. Otherwise trigger a simple refresh.
        if (canGoBackward()) {
          onBackArrowClick();
          // small delay to let state update
          setTimeout(() => {
            onForwardArrowClick();
          }, 80);
        } else if (canGoForward()) {
          // We can only go forward — just do forward then back
          onForwardArrowClick();
          setTimeout(() => {
            onBackArrowClick();
          }, 80);
        } else {
          // fallback: refresh current view
          handleRefresh().catch(console.error);
        }
      } catch (e) {
        console.error('nav-back-forward handler error', e);
      }
    };

    window.addEventListener('nav-back-forward', onNavBackForward as EventListener);
    return () => window.removeEventListener('nav-back-forward', onNavBackForward as EventListener);
  }, [historyPlace, pathHistory, onBackArrowClick, onForwardArrowClick]);

  async function handleRefresh() {
    if (pathHistory[historyPlace] === "") {
      await getVolumes();
    } else {
      await getNewDirectoryContents();
    }
  }

  const settings = useAppSelector(selectSettings);

  const rootClass = (() => {
    const themeClass = settings.theme === 'dark' ? 'dark' : '';
    const densityClass = settings.density === 'compact' ? 'density-compact' : settings.density === 'spacious' ? 'density-spacious' : '';
    const invertClass = settings.invertText ? 'invert-text' : '';
    const animClass = settings.animationsEnabled ? '' : 'no-animations';
    return `${themeClass} ${densityClass} ${invertClass} ${animClass}`.trim();
  })();

  const handleTabChange = (tabId: string) => {
    setSelectedFile(null);
    setSearchResults([]);
  };

  return (
    <div className={rootClass + " bg-[#ececec]"} style={{ ['--accent' as any]: settings.accentColor }} onClick={(e) => {
      handleCloseContextMenu(e);

      if (e.target instanceof HTMLElement) {
        if (e.target.id === DIRECTORY_ENTITY_ID) return;
      }

      dispatch(unselectDirectoryContents());
      // clear preview selection when clicking outside
      setSelectedFile(null);
    }} onContextMenu={handleMainContextMenu}>
      <ContextMenus />
      <VaultTrigger onTrigger={() => setVaultModalOpen(true)} />
      <VaultModal isOpen={vaultModalOpen} onClose={() => setVaultModalOpen(false)} />

      <div className="flex flex-col h-screen">
        {/* Tab Bar */}
        <TabBar onTabChange={handleTabChange} />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4 overflow-auto">
            <FolderNavigation
              onBackArrowClick={onBackArrowClick}
              canGoBackward={canGoBackward()}
              onForwardArrowClick={onForwardArrowClick}
              canGoForward={canGoForward()}
              onRefresh={handleRefresh}
              currentDirectoryPath={pathHistory[historyPlace]}
              currentVolume={currentVolume}
              setSearchResults={setSearchResults}
            />

            <div className="pb-5">
              <DragDropZone className="relative">
                <div>
                  {pathHistory[historyPlace] === "" && searchResults.length === 0 ? (
                    <>
                      <VolumeList volumes={volumes} onClick={onVolumeClick} />
                      <RecentFiles 
                        recentFiles={recentFiles}
                        onFileSelect={(filePath) => {
                          setSelectedFile(filePath);
                          saveRecentFile(filePath);
                        }}
                        onClear={clearRecentFiles}
                      />
                    </>
                  ) : (
                    <>
                      <DirectoryContents
                        content={
                          searchResults.length === 0 ? directoryContents : searchResults
                        }
                        onDirectoryClick={onDirectoryClick}
                        onFileSelect={(file) => {
                          setSelectedFile(file);
                          if (file) {
                            saveRecentFile(file);
                          }
                        }}
                        selectedFile={selectedFile}
                        onFolderSelect={handleFolderSelect}
                      />
                      {/* Duplicate Detector UI below directory listing */}
                      <DuplicateDetector directory={pathHistory[historyPlace]} />
                    </>
                  )}

                  {/* Floating preview box at bottom-right (only when enabled in settings) */}
                  {settings.showPreview && selectedFile && (
                    <div 
                      className="fixed bottom-6 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                      style={{
                        right: selectedFile && settings.showPreview ? 'calc(384px + 24px + 24px)' : '24px'
                      }}
                    >
                      <div className="flex items-center justify-between p-2 border-b border-gray-100">
                        <div className="text-sm text-gray-700 font-semibold">Preview</div>
                        <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-gray-800">✕</button>
                      </div>
                      <div className="p-2">
                        <FilePreview file={selectedFile} />
                      </div>
                    </div>
                  )}
                </div>
              </DragDropZone>
            </div>
          </div>

          {/* Show metadata panel when file is selected, otherwise show folder tree sidebar */}
          {selectedFile && settings.showPreview ? (
            <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border-b border-gray-100 sticky top-0 bg-white">
                <div className="text-sm text-gray-700 font-semibold">Details</div>
                <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-gray-800">✕</button>
              </div>
              <div className="p-3">
                <FileMetadata filePath={selectedFile} />
              </div>
            </div>
          ) : selectedFolder && (
            <FolderTreeSidebar
              folderPath={selectedFolder}
              folderName={selectedFolder.split(/[\\/]/).pop() || ""}
              treeData={selectedFolderTree}
              onFileSelect={setSelectedFile}
              onFileOpen={async (p) => {
                try {
                  await openFile(p);
                } catch (err) {
                  console.error('Failed to open file from sidebar:', err);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
