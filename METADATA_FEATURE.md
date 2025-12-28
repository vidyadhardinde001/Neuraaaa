# File Metadata Display Feature

## Overview
The file metadata feature adds Windows Explorer-like details panel to the NeuraFile file manager. When you click on a file or folder, a "Details" panel appears at the bottom-right corner of the screen showing comprehensive metadata.

## Features

### Metadata Display
When a file is selected and preview is enabled (via Settings), the Details panel shows:

- **Thumbnail/Icon**: Preview image for image files, or file type icon for other files
- **File Name**: Display name of the file
- **File Type**: Human-readable file type (e.g., "JPEG Image", "PDF Document", "Text File")
- **Size**: File size in human-readable format (Bytes, KB, MB, GB)
- **Location**: Full file path
- **Date Modified**: Last modification date and time
- **Date Created**: File creation date (if available)
- **Date Accessed**: Last access date (if available)
- **Dimensions**: Image dimensions for image files (e.g., "1024 x 768")
- **Properties Button**: Placeholder for advanced properties dialog

### File Type Support
The metadata display automatically detects and displays appropriate file type labels for:
- Text Files: `.txt`, `.md`, `.json`, etc.
- Documents: `.pdf`, `.doc`, `.docx`, etc.
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.avi`, `.mov`, etc.
- Audio: `.mp3`, `.wav`, `.flac`, etc.
- Archives: `.zip`, `.rar`, `.7z`, etc.
- Executables: `.exe`, `.dll`, etc.
- And many more...

### Image Thumbnail Generation
For image files, the system automatically:
1. Reads the image file
2. Generates a thumbnail preview
3. Displays dimensions in the metadata panel
4. Includes the image in the details sidebar

## How to Use

1. **Enable Preview Panel**: Go to Settings and ensure "Show Preview" is enabled
2. **Select a File**: Click on any file or folder in the file browser
3. **View Details**: A "Details" panel will appear at the bottom-right corner with all file metadata
4. **Copy Path**: Use the copy button to copy the full file path to clipboard
5. **Close Panel**: Click the ✕ button to close the Details panel

## Implementation Details

### Components
- **FileMetadata.tsx**: Main component that displays the metadata panel
  - Fetches metadata using Tauri's `metadata_for_path` command
  - Loads image thumbnails using `preview_binary_file` command
  - Formats file sizes and dates for display
  - Handles loading and error states

### Integration
The FileMetadata component is integrated into `App.tsx` as a floating panel that displays when:
- A file is selected (via `selectedFile` state)
- Preview is enabled in settings (via `settings.showPreview`)

### Backend Support
The feature relies on Tauri commands that provide:
- File metadata (size, dates, type)
- Image dimensions
- File preview data for thumbnails

## Styling
The metadata panel uses Tailwind CSS and is styled to match Windows Explorer's Details pane:
- Clean, minimal design with proper spacing
- Gray/white color scheme
- Hover states for interactive elements
- Responsive layout that works on different screen sizes
- Fixed positioning at bottom-right corner

## Future Enhancements
- [ ] Advanced Properties dialog with extended attributes
- [ ] File permissions display (on supported systems)
- [ ] Favorite/tag files from metadata panel
- [ ] Quick file operations (copy, move, delete) from details panel
- [ ] File hash/checksum display
- [ ] Owner/creator information for system files
