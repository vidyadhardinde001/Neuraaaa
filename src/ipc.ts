import {DirectoryContent} from "./types";
import {invoke} from "@tauri-apps/api/core";

export interface RenamerResult {
  success: boolean;
  message: string;
  renamed_files: string[];
}

interface RenameConfig {
  method: 'rule-based' | 'openai';
  openai_key?: string;
  scheme?: string;
}

export async function openDirectory(path: string): Promise<DirectoryContent[]> {
   return invoke("open_directory", { path });
}

export async function openFile(path: string): Promise<string> {
   return invoke<string>("open_file", { path });
}

export async function createFile(path: string): Promise<void> {
   return invoke("create_file", { path });
}

export async function createDirectory(path: string): Promise<void> {
   return invoke("create_directory", { path });
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
   return invoke("rename_file", { oldPath, newPath });
}

export async function deleteFile(path: string): Promise<void> {
   return invoke("delete_file", { path });
}

export async function smartRenameFiles(
  folderPath: string,
  config: RenameConfig
): Promise<RenamerResult> {
  console.log("🚀 Invoking smart_rename_files with args:", { folderPath, config });
  return invoke<RenamerResult>("smart_rename_files", { 
    folder_path: folderPath,
    config
  });
}

export async function getRenamerSchemes(): Promise<string[]> {
   return invoke("get_renamer_schemes");
}

export async function copyFile(path: string): Promise<void> {
   return invoke("copy_file", { path });
}

export async function pasteFile(destinationDir: string): Promise<string> {
   return invoke("paste_file", { destination: destinationDir });
}

export async function getClipboardPath(): Promise<string> {
   return invoke("get_clipboard_path");
}

