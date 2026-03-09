use crate::errors::Error;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref CLIPBOARD: Mutex<Option<String>> = Mutex::new(None);
}

/// Store a file/folder path in the application clipboard
pub fn set_clipboard_path(path: &str) -> Result<(), Error> {
    let mut clipboard = CLIPBOARD.lock()
        .map_err(|_| Error::Custom("Failed to acquire clipboard lock".to_string()))?;
    *clipboard = Some(path.to_string());
    Ok(())
}

/// Get the file/folder path from the application clipboard
pub fn get_clipboard_path() -> Result<String, Error> {
    let clipboard = CLIPBOARD.lock()
        .map_err(|_| Error::Custom("Failed to acquire clipboard lock".to_string()))?;
    clipboard.as_ref()
        .cloned()
        .ok_or_else(|| Error::Custom("Clipboard is empty. Copy a file or folder first.".to_string()))
}

/// Clear the application clipboard
pub fn clear_clipboard_path() -> Result<(), Error> {
    let mut clipboard = CLIPBOARD.lock()
        .map_err(|_| Error::Custom("Failed to acquire clipboard lock".to_string()))?;
    *clipboard = None;
    Ok(())
}
