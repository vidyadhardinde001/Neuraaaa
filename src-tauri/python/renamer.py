import os
import mimetypes
import hashlib
import datetime
import re
from pathlib import Path

try:
    from PIL import Image, ExifTags
    from mutagen import File as AudioFile
except ImportError:
    print("⚠️ Install dependencies first: pip install pillow mutagen pypdf2")

try:
    from PyPDF2 import PdfReader
except ImportError:
    pass


def get_size_bucket(size_bytes):
    """Classify file size into Low, Mid, High"""
    if size_bytes < 1_000_000:   # <1 MB
        return "Low"
    elif size_bytes < 100_000_000:  # <100 MB
        return "Mid"
    else:
        return "High"


def safe_filename(name):
    """Remove illegal characters for filenames"""
    return re.sub(r'[\\/*?:"<>|]', "_", name)


def extract_text_snippet(filepath):
    """Extract text snippet from .txt or .pdf files"""
    ext = Path(filepath).suffix.lower()
    snippet = ""

    try:
        if ext == ".txt":
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                snippet = f.read(100).strip()
        elif ext == ".pdf":
            reader = PdfReader(filepath)
            if reader.pages:
                snippet = reader.pages[0].extract_text()[:100].strip()
    except Exception:
        pass

    return safe_filename(snippet) if snippet else "content"


def extract_image_metadata(filepath):
    """Extract resolution and camera info from image"""
    try:
        img = Image.open(filepath)
        width, height = img.size
        resolution = f"{width}x{height}"

        exif_data = {}
        if hasattr(img, "_getexif") and img._getexif():
            for tag, value in img._getexif().items():
                decoded = ExifTags.TAGS.get(tag, tag)
                exif_data[decoded] = value

        camera = exif_data.get("Model", "unknownCamera")
        return resolution, safe_filename(str(camera))
    except Exception:
        return "unknownRes", "unknownCamera"


def extract_audio_metadata(filepath):
    """Extract metadata from audio"""
    try:
        audio = AudioFile(filepath)
        if not audio:
            return "unknownArtist", "unknownAlbum"

        artist = audio.tags.get("TPE1", ["unknownArtist"])[0] if audio.tags else "unknownArtist"
        album = audio.tags.get("TALB", ["unknownAlbum"])[0] if audio.tags else "unknownAlbum"
        return safe_filename(str(artist)), safe_filename(str(album))
    except Exception:
        return "unknownArtist", "unknownAlbum"


def get_file_hash(filepath):
    """Generate a short hash of the file for uniqueness"""
    h = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            h.update(f.read(4096))  # only first 4KB
    except Exception:
        return "nohash"
    return h.hexdigest()[:8]


def smart_file_renamer(folder_path, scheme="{folder}_{type}_{extra}_{size}_{date}_{hash}_{i}{ext}"):
    """
    Advanced smart file renamer with content + metadata analysis.
    :param folder_path: Path to folder
    :param scheme: Custom renaming format
    """
    files = os.listdir(folder_path)
    files.sort()

    for i, filename in enumerate(files, start=1):
        old_path = os.path.join(folder_path, filename)
        if os.path.isdir(old_path):
            continue

        size_bytes = os.path.getsize(old_path)
        size_bucket = get_size_bucket(size_bytes)
        ext = Path(filename).suffix
        folder_name = Path(folder_path).name

        # MIME type
        mime_type, _ = mimetypes.guess_type(old_path)
        main_type, sub_type = ("unknown", "file")
        if mime_type:
            parts = mime_type.split("/")
            main_type, sub_type = parts[0], parts[1]

        # Metadata
        extra = "meta"
        if main_type == "text" or ext.lower() in [".txt", ".pdf"]:
            extra = extract_text_snippet(old_path)
        elif main_type == "image":
            res, cam = extract_image_metadata(old_path)
            extra = f"{res}_{cam}"
        elif main_type == "audio":
            artist, album = extract_audio_metadata(old_path)
            extra = f"{artist}_{album}"
        elif main_type == "video":
            extra = "videoFile"

        # Dates
        ctime = datetime.datetime.fromtimestamp(os.path.getctime(old_path)).strftime("%Y%m%d")

        # File hash
        file_hash = get_file_hash(old_path)

        # Build new name from scheme
        new_name = scheme.format(
            folder=folder_name,
            type=f"{main_type}_{sub_type}",
            extra=extra,
            size=size_bucket,
            date=ctime,
            hash=file_hash,
            i=i,
            ext=ext
        )

        new_name = safe_filename(new_name)
        new_path = os.path.join(folder_path, new_name)

        # Resolve conflicts
        counter = 1
        while os.path.exists(new_path):
            new_path = os.path.join(folder_path, f"{Path(new_name).stem}_{counter}{ext}")
            counter += 1

        os.rename(old_path, new_path)
        print(f"✅ Renamed: {filename} -> {Path(new_path).name}")


if __name__ == "__main__":
    folder = input("📂 Enter the folder path to rename files: ").strip('"').strip("'")
    if os.path.isdir(folder):
        smart_file_renamer(folder)
    else:
        print("❌ Invalid folder path!")
