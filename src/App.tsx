import {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {DirectoryContent, Volume} from "./types";
import DuplicateDetector from "./components/MainBody/DuplicateDetector";
import {openDirectory} from "./ipc";
import VolumeList from "./components/MainBody/Volumes/VolumeList";
import FolderNavigation from "./components/TopBar/FolderNavigation";
import {DirectoryContents} from "./components/MainBody/DirectoryContents";
import FilePreview from "./components/FilePreview";
import useNavigation from "./hooks/useNavigation";
import SearchBar from "./components/TopBar/SearchBar";
import {useAppDispatch, useAppSelector} from "./state/hooks";
import useContextMenu from "./hooks/useContextMenu";
import ContextMenus from "./components/ContextMenus/ContextMenus";
import {
  selectDirectoryContents,
  unselectDirectoryContents,
  updateDirectoryContents
} from "./state/slices/currentDirectorySlice";
import {DIRECTORY_ENTITY_ID} from "./components/MainBody/DirectoryEntity";

function App() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const directoryContents = useAppSelector(selectDirectoryContents);
  const dispatch = useAppDispatch();

  const [searchResults, setSearchResults] = useState<DirectoryContent[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const {
    pathHistory,
    historyPlace,
    setHistoryPlace,
    onBackArrowClick,
    onForwardArrowClick,
    canGoBackward,
    canGoForward,
    currentVolume,
    setCurrentVolume,
  } = useNavigation(searchResults, setSearchResults);

  async function getNewDirectoryContents() {
    const contents = await openDirectory(pathHistory[historyPlace]);
    dispatch(updateDirectoryContents(contents));
  }

  async function onVolumeClick(mountpoint: string) {
    if (pathHistory[pathHistory.length - 1] != mountpoint) {
      pathHistory.push(mountpoint);
    }
    setHistoryPlace(pathHistory.length - 1);
    setCurrentVolume(mountpoint);

    await getNewDirectoryContents();
  }

  async function onDirectoryClick(filePath: string) {
    if (searchResults.length > 0) {
      setSearchResults([]);
    }
    // clear selected file when navigating into a directory
    setSelectedFile(null);
    pathHistory.push(filePath);
    setHistoryPlace(pathHistory.length - 1);

    await getNewDirectoryContents();
  }

  async function getVolumes() {
    if (volumes.length > 0) {
      return;
    }

    const newVolumes = await invoke<Volume[]>("get_volumes");
    setVolumes(newVolumes);
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

    getNewDirectoryContents().catch(console.error);
  }, [historyPlace]);

  const [handleMainContextMenu, handleCloseContextMenu] = useContextMenu(dispatch, pathHistory[historyPlace]);

  async function handleRefresh() {
    if (pathHistory[historyPlace] === "") {
      await getVolumes();
    } else {
      await getNewDirectoryContents();
    }
  }

  return (
    <div className="bg-[#ececec]" onClick={(e) => {
      handleCloseContextMenu(e);

      if (e.target instanceof HTMLElement) {
        if (e.target.id === DIRECTORY_ENTITY_ID) return;
      }

      dispatch(unselectDirectoryContents());
      // clear preview selection when clicking outside
      setSelectedFile(null);
    }} onContextMenu={handleMainContextMenu}>
      <ContextMenus />

      <div className="p-4">
        <FolderNavigation
            onBackArrowClick={onBackArrowClick}
            canGoBackward={canGoBackward()}
            onForwardArrowClick={onForwardArrowClick}
            canGoForward={canGoForward()}
            onRefresh={handleRefresh}
        />

        <div className="pb-5">
          <SearchBar
              currentVolume={currentVolume}
              currentDirectoryPath={pathHistory[historyPlace]}
              setSearchResults={setSearchResults}
          />

          <div>
            {pathHistory[historyPlace] === "" && searchResults.length === 0 ? (
                <VolumeList volumes={volumes} onClick={onVolumeClick} />
            ) : (
                <>
                  <DirectoryContents
                    content={
                      searchResults.length === 0 ? directoryContents : searchResults
                    }
                    onDirectoryClick={onDirectoryClick}
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                  />
                  {/* Duplicate Detector UI below directory listing */}
                  <DuplicateDetector directory={pathHistory[historyPlace]} />
                </>
            )}

            {/* Floating preview box at bottom-right */}
            {selectedFile && (
              <div className="fixed right-6 bottom-6 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="flex items-center justify-between p-2 border-b border-gray-100">
                  <div className="text-sm text-gray-700">Preview</div>
                  <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-gray-800">✕</button>
                </div>
                <div className="p-2">
                  <FilePreview file={selectedFile} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
