use std::fs;
use std::path::Path;
use serde::Serialize;
use tauri::command;

#[derive(Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[command]
pub fn read_dir_recursive(path: String) -> Result<FileNode, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("Path not found".to_string());
    }

    fn build_tree(path: &Path) -> FileNode {
        let name = path.file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.display().to_string());

        let is_dir = path.is_dir();

        let children = if is_dir {
            match fs::read_dir(path) {
                Ok(entries) => {
                    let mut nodes = Vec::new();
                    for entry in entries.flatten() {
                        let entry_path = entry.path();
                        nodes.push(build_tree(&entry_path));
                    }
                    Some(nodes)
                }
                Err(_) => None,
            }
        } else {
            None
        };

        FileNode {
            name,
            path: path.display().to_string(),
            is_dir,
            children,
        }
    }

    Ok(build_tree(path_obj))
}
