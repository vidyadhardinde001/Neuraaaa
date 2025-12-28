// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod errors;
mod filesystem;
mod search;
mod duplicate_detector;
mod file_preview;
mod vault;
mod content_scanner;

use filesystem::explorer::{
    create_directory, create_file, delete_file, open_directory, open_file, rename_file,
};
use filesystem::volume::get_volumes;
use search::search_directory;
use vault::{vault_create, vault_open, vault_lock, vault_list_entries, vault_import_file, vault_export_file, vault_delete_entry, vault_generate_recovery_codes};
use content_scanner::scan_directory_for_sensitive_files;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, atomic::AtomicU64};
use filesystem::folder_tree::read_dir_recursive;
use vault::VaultSession;

#[derive(Serialize, Deserialize, Clone)]
pub struct CachedPath {
    #[serde(rename = "p")]
    file_path: String,
    #[serde(rename = "t")]
    file_type: String,
}

pub type VolumeCache = HashMap<String, Vec<CachedPath>>;

#[derive(Default)]
pub struct AppState {
    pub system_cache: HashMap<String, VolumeCache>,
    pub active_search_id: AtomicU64,
    pub vault_sessions: HashMap<String, VaultSession>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            system_cache: HashMap::new(),
            active_search_id: AtomicU64::new(0),
            vault_sessions: HashMap::new(),
        }
    }
}

pub type StateSafe = Arc<Mutex<AppState>>;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        // built-in plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())

        // register all backend commands
        .invoke_handler(tauri::generate_handler![
            // filesystem
            get_volumes,
            open_directory,
            search_directory,
            open_file,
            create_file,
            create_directory,
            rename_file,
            delete_file,
            read_dir_recursive,
            // duplicate detector
            duplicate_detector::find_duplicate_files,
            duplicate_detector::delete_files,

            file_preview::preview_text_file
            ,
            file_preview::preview_binary_file
            ,
            file_preview::metadata_for_path,
            
            // vault
            vault_create,
            vault_open,
            vault_lock,
            vault_list_entries,
            vault_import_file,
            vault_export_file,
            vault_delete_entry,
            vault_generate_recovery_codes,
            
            // content scanner
            scan_directory_for_sensitive_files,
        ])

        // shared application state
        .manage(Arc::new(Mutex::new(AppState::default())))

        // run the app
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
