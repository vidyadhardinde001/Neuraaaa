export interface Volume {
    name: string;
    mountpoint: string;
    available_gb: number;
    used_gb: number;
    total_gb: number;
}

export type DirectoryEntityType = "file" | "directory";
export type DirectoryContentType = "File" | "Directory";

export interface DirectoryContent {
    [key: string]: [string, string]; // Key will be either "Directory" or "File"
}

export enum ContextMenuType {
    None,
    General,
    DirectoryEntity,
}

// Types for File Renaming feature
export interface RenamerResult {
    success: boolean;
    message: string;
    renamed_files: string[];
}

export type RenameMethod = 'rule-based' | 'openai';

export interface RenameScheme {
    name: string;
    pattern: string;
    description: string;
}

// Types for file operations
export interface FileMeta {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    created?: string;   // ISO timestamp from Rust’s SystemTime
    modified?: string;
}

// DirectoryChild (matches Rust enum)
export type DirectoryChild = {
  type: "file";
  meta: {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    created?: string;
    modified?: string;
  };
} | {
  type: "directory";
  meta: {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    created?: string;
    modified?: string;
  };
};


// Types for preview functionality
export interface RenamePreview {
    oldName: string;
    newName: string;
    path: string;
}

// Types for error handling
export interface RenameError {
    code: string;
    message: string;
    file?: string;
}

// Types for rename settings
export interface RenameSettings {
    method: RenameMethod;
    scheme: string;
    openaiApiKey?: string;
    previewEnabled: boolean;
    preserveExtension: boolean;
    recursiveRename: boolean;
}

export interface ScoredDirectoryContent {
    type: "file" | "directory";
    name: string;
    path: string;
    score: number;
}

