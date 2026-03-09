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

    // Move to Recycle Bin instead of permanent deletion
    let res = trash::delete(&path);
    match res {
        Ok(_) => Ok(()),
        Err(err) => Err(Error::Custom(format!("Failed to move to Recycle Bin: {}", err))),
    }
}

#[tauri::command]
pub async fn copy_file(path: String) -> Result<(), Error> {
    use crate::filesystem::clipboard;
    clipboard::set_clipboard_path(&path)?;
    Ok(())
}

#[tauri::command]
pub async fn get_clipboard_path() -> Result<String, Error> {
    use crate::filesystem::clipboard;
    clipboard::get_clipboard_path()
}

#[tauri::command]
pub async fn paste_file(state_mux: State<'_, StateSafe>, destination: String) -> Result<String, Error> {
    use crate::filesystem::clipboard;

    // Get the source path from the backend clipboard
    let source_path = clipboard::get_clipboard_path()?;
    let source_meta = fs::metadata(&source_path)
        .map_err(|e| Error::Custom(format!("Source file not found: {}", e)))?;

    // Derive the filename from the source path
    let source_file_name = Path::new(&source_path)
        .file_name()
        .ok_or_else(|| Error::Custom("Could not determine source filename".to_string()))?
        .to_string_lossy()
        .to_string();

    // Build the full destination path by joining directory + filename
    let dest_full_path = Path::new(&destination).join(&source_file_name);
    let destination_path = dest_full_path.to_string_lossy().to_string();

    if source_meta.is_dir() {
        copy_dir_recursive(&source_path, &destination_path)?;
    } else {
        fs::copy(&source_path, &destination_path)
            .map_err(|e| Error::Custom(format!("Failed to copy file: {}", e)))?;
    }

    let mount_point_str = get_mount_point(destination_path.clone()).unwrap_or_default();
    let fs_event_manager = FsEventHandler::new(state_mux.deref().clone(), mount_point_str.into());
    fs_event_manager.handle_create(
        if source_meta.is_dir() { CreateKind::Folder } else { CreateKind::File },
        &dest_full_path,
    );

    // Do NOT clear clipboard after paste — allow multiple pastes
    Ok(source_file_name)
}

fn copy_dir_recursive(src: &str, dst: &str) -> Result<(), Error> {
    fs::create_dir_all(dst)
        .map_err(|e| Error::Custom(format!("Failed to create destination directory: {}", e)))?;

    for entry in fs::read_dir(src)
        .map_err(|e| Error::Custom(format!("Failed to read source directory: {}", e)))?
    {
        let entry = entry
            .map_err(|e| Error::Custom(format!("Failed to read directory entry: {}", e)))?;
        let path = entry.path();
        let file_name = path.file_name()
            .ok_or_else(|| Error::Custom("Invalid filename".to_string()))?;
        let dest_path = Path::new(dst).join(file_name);

        if path.is_dir() {
            copy_dir_recursive(
                path.to_str().unwrap_or(""),
                dest_path.to_str().unwrap_or(""),
            )?;
        } else {
            fs::copy(&path, &dest_path)
                .map_err(|e| Error::Custom(format!("Failed to copy file: {}", e)))?;
        }
    }

    Ok(())
}
