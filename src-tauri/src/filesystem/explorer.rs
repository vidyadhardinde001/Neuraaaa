use crate::errors::Error;
use crate::filesystem::cache::FsEventHandler;
use crate::filesystem::fs_utils::get_mount_point;
use crate::filesystem::volume::{DirectoryChild, FileMeta};
use crate::StateSafe;

use notify::event::CreateKind;
use std::fs;
use std::fs::read_dir;
use std::ops::Deref;
use std::path::Path;
use tauri::State;

use chrono::{DateTime, Local};
use std::time::SystemTime;

/// Opens a file at the given path. Returns a string if there was an error.
#[tauri::command]
pub async fn open_file(path: String) -> Result<(), Error> {
    let output_res = open::commands(path)[0].output();
    let output = match output_res {
        Ok(output) => output,
        Err(err) => {
            let err_msg = format!("Failed to get open command output: {}", err);
            return Err(Error::Custom(err_msg));
        }
    };

    if output.status.success() {
        return Ok(());
    }

    let err_msg = String::from_utf8(output.stderr)
        .unwrap_or(String::from("Failed to open file and deserialize stderr."));
    Err(Error::Custom(err_msg))
}

fn system_time_to_string(st: Option<SystemTime>) -> Option<String> {
    st.map(|time| {
        let datetime: DateTime<Local> = time.into();
        datetime.format("%Y-%m-%d %H:%M:%S").to_string()
    })
}

/// Searches and returns the files in a given directory. This is not recursive.
#[tauri::command]
pub async fn open_directory(path: String) -> Result<Vec<DirectoryChild>, ()> {
    let Ok(directory) = read_dir(path) else {
        return Ok(Vec::new());
    };

    Ok(directory
        .filter_map(|entry| entry.ok())
        .map(|entry| {
            let metadata = entry.metadata().unwrap();
            let file_meta = FileMeta {
    name: entry.file_name().to_string_lossy().to_string(),
    path: entry.path().to_string_lossy().to_string(),
    is_dir: metadata.is_dir(),
    size: metadata.len(),
    created: system_time_to_string(metadata.created().ok()),
    modified: system_time_to_string(metadata.modified().ok()),
};

            if file_meta.is_dir {
                DirectoryChild::Directory(file_meta)
            } else {
                DirectoryChild::File(file_meta)
            }
        })
        .collect())
}

#[tauri::command]
pub async fn create_file(state_mux: State<'_, StateSafe>, path: String) -> Result<(), Error> {
    let mount_point_str = get_mount_point(path.clone()).unwrap_or_default();

    let fs_event_manager = FsEventHandler::new(state_mux.deref().clone(), mount_point_str.into());
    fs_event_manager.handle_create(CreateKind::File, Path::new(&path));

    let res = fs::File::create(path);
    match res {
        Ok(_) => Ok(()),
        Err(err) => Err(Error::Custom(err.to_string())),
    }
}

#[tauri::command]
pub async fn create_directory(state_mux: State<'_, StateSafe>, path: String) -> Result<(), Error> {
    let mount_point_str = get_mount_point(path.clone()).unwrap_or_default();

    let fs_event_manager = FsEventHandler::new(state_mux.deref().clone(), mount_point_str.into());
    fs_event_manager.handle_create(CreateKind::Folder, Path::new(&path));

    let res = fs::create_dir(path);
    match res {
        Ok(_) => Ok(()),
        Err(err) => Err(Error::Custom(err.to_string())),
    }
}

#[tauri::command]
pub async fn rename_file(
    state_mux: State<'_, StateSafe>,
    old_path: String,
    new_path: String,
) -> Result<(), Error> {
    let mount_point_str = get_mount_point(old_path.clone()).unwrap_or_default();

    let mut fs_event_manager =
        FsEventHandler::new(state_mux.deref().clone(), mount_point_str.into());
    fs_event_manager.handle_rename_from(Path::new(&old_path));
    fs_event_manager.handle_rename_to(Path::new(&new_path));

    let res = fs::rename(old_path, new_path);
    match res {
        Ok(_) => Ok(()),
        Err(err) => Err(Error::Custom(err.to_string())),
    }
}

#[tauri::command]
pub async fn delete_file(state_mux: State<'_, StateSafe>, path: String) -> Result<(), Error> {
    let mount_point_str = get_mount_point(path.clone()).unwrap_or_default();

    let fs_event_manager = FsEventHandler::new(state_mux.deref().clone(), mount_point_str.into());
    fs_event_manager.handle_delete(Path::new(&path));

    let res = fs::remove_file(path);
    match res {
        Ok(_) => Ok(()),
        Err(err) => Err(Error::Custom(err.to_string())),
    }
}
