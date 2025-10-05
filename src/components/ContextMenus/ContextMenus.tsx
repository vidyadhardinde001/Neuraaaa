import { ContextMenuType } from "../../types";
import ContextMenu from "./ContextMenu";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import InputModal from "../InputModal";
import FileRenamerModal from "../FileRenamerModal";
import DuplicateDetectorModal from "../DuplicateDetectorModal";
import { useState, useEffect } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  DirectoryEntityContextPayload,
  GeneralContextPayload,
  updateContextMenu,
} from "../../state/slices/contextMenuSlice";
import {
  createFile,
  createDirectory,
  deleteFile,
  renameFile,
  RenamerResult,
} from "../../ipc";
import {
  addContent,
  deleteContent,
  renameContent,
  selectContentIdx,
} from "../../state/slices/currentDirectorySlice";
import { createDirectoryContent, removeFileNameFromPath } from "../../util";

export default function ContextMenus() {
  const { currentContextMenu, contextMenuPayload } = useAppSelector(
    (state) => state.contextMenu
  );
  const [newFileShown, setNewFileShown] = useState(false);
  const [newDirectoryShown, setNewDirectoryShown] = useState(false);
  const [renameFileShown, setRenameFileShown] = useState(false);
  const [fileRenamerShown, setFileRenamerShown] = useState(false);

  // Duplicate detection
  const [duplicateModalShown, setDuplicateModalShown] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicateDeleteLoading, setDuplicateDeleteLoading] = useState(false);

  const directoryEntityPayload =
    contextMenuPayload as DirectoryEntityContextPayload;
  const generalPayload = contextMenuPayload as GeneralContextPayload;
  const dispatch = useAppDispatch();

  // === Global right-click for "background" ===
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // If you right-click on something with data-contextmenu="entity"
      // let that element handle it instead
      const target = e.target as HTMLElement;
      if (target.closest("[data-contextmenu='entity']")) return;

      e.preventDefault();

      dispatch(
        updateContextMenu({
          type: ContextMenuType.General,
          mouseX: e.clientX,
          mouseY: e.clientY,
          contextMenuPayload: {
            currentPath: generalPayload?.currentPath || "", // make sure currentPath is available
          },
        })
      );
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () =>
      document.removeEventListener("contextmenu", handleContextMenu);
  }, [dispatch, generalPayload?.currentPath]);

  // Fetch duplicates
  async function onFindDuplicates() {
    setDuplicateDeleteLoading(true);
    try {
      const dir = generalPayload.currentPath;
      const result = await invoke<any[]>("find_duplicate_files", { dir });
      if (!result || result.length === 0) {
        alert("No duplicate files found.");
      } else {
        setDuplicates(result);
        setDuplicateModalShown(true);
      }
    } catch (e: any) {
      alert(e.toString());
    }
    setDuplicateDeleteLoading(false);
  }

  // New file
  async function onNewFile(name: string) {
    try {
      const path = `${generalPayload.currentPath}\\${name}`;
      await createFile(path);
      const newDirectoryContent = createDirectoryContent("File", name, path);
      dispatch(addContent(newDirectoryContent));
      dispatch(selectContentIdx(0));
    } catch (e) {
      alert(e);
    }
  }

  // New folder
  async function onNewFolder(name: string) {
    try {
      const path = `${generalPayload.currentPath}\\${name}`;
      await createDirectory(path);
      const newDirectoryContent = createDirectoryContent(
        "Directory",
        name,
        path
      );
      dispatch(addContent(newDirectoryContent));
      dispatch(selectContentIdx(0));
    } catch (e) {
      alert(e);
    }
  }

  // Rename
  async function onRename(newName: string) {
    try {
      const path = removeFileNameFromPath(directoryEntityPayload.filePath);
      const oldPath = `${path}\\${directoryEntityPayload.fileName}`;
      const newPath = `${path}\\${newName}`;
      await renameFile(oldPath, newPath);

      const oldContent = createDirectoryContent(
        directoryEntityPayload.type,
        directoryEntityPayload.fileName,
        oldPath
      );
      const newContent = createDirectoryContent(
        directoryEntityPayload.type,
        newName,
        newPath
      );
      dispatch(renameContent([oldContent, newContent]));
      dispatch(selectContentIdx(0));
    } catch (e) {
      alert(e);
    }
  }

  // Delete single file/folder
  async function onDelete() {
    const result = await confirm(
      `Are you sure you want to delete "${directoryEntityPayload.fileName}"?`
    );
    if (!result) return;

    try {
      await deleteFile(directoryEntityPayload.filePath);
      const content = createDirectoryContent(
        directoryEntityPayload.type,
        directoryEntityPayload.fileName,
        directoryEntityPayload.filePath
      );
      dispatch(deleteContent(content));
    } catch (e) {
      alert(e);
    }
  }

  // File renamer success
  function onFileRenamerSuccess(result: RenamerResult) {
    window.location.reload();
  }

  return (
    <>
      {currentContextMenu === ContextMenuType.General ? (
        <ContextMenu
          options={[
            { name: "New File", onClick: () => setNewFileShown(true) },
            { name: "New Folder", onClick: () => setNewDirectoryShown(true) },
            { name: "Smart Rename Files", onClick: () => setFileRenamerShown(true) },
            {
              name: duplicateDeleteLoading ? "Scanning..." : "Find Duplicates",
              onClick: onFindDuplicates,
              disabled: duplicateDeleteLoading,
            },
          ]}
        />
      ) : currentContextMenu === ContextMenuType.DirectoryEntity ? (
        <ContextMenu
          options={[
            { name: "Rename", onClick: () => setRenameFileShown(true) },
            { name: "Delete", onClick: onDelete },
          ]}
        />
      ) : null}

      {/* Modals */}
      <InputModal
        shown={newFileShown}
        setShown={setNewFileShown}
        title="Create New File?"
        onSubmit={onNewFile}
        submitName="Create"
      />
      <InputModal
        shown={newDirectoryShown}
        setShown={setNewDirectoryShown}
        title="Create New Folder?"
        onSubmit={onNewFolder}
        submitName="Create"
      />
      <InputModal
        shown={renameFileShown}
        setShown={setRenameFileShown}
        title="Rename File"
        onSubmit={onRename}
        submitName="Rename"
      />
      {/* <FileRenamerModal 
          shown={fileRenamerShown} 
          setShown={setFileRenamerShown} 
          folderPath={generalPayload.currentPath}
          onSuccess={onFileRenamerSuccess}
      /> */}
      <DuplicateDetectorModal
        shown={duplicateModalShown}
        setShown={setDuplicateModalShown}
        duplicates={duplicates}
      />
    </>
  );
}
