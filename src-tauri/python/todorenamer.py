import os
import re
import time
from dotenv import load_dotenv
from openai import OpenAI
from PyPDF2 import PdfReader

# --- Method 1: File Reading Functions ---

def extract_text_from_file(filepath):
    """
    Extracts text from the first page of a PDF or the content of a TXT file.
    
    Args:
        filepath (str): The path to the file.
        
    Returns:
        str: The extracted text, or an empty string if extraction fails.
    """
    _, file_extension = os.path.splitext(filepath)
    file_extension = file_extension.lower()

    if file_extension == '.pdf':
        try:
            with open(filepath, 'rb') as file:
                reader = PdfReader(file)
                if reader.pages:
                    return reader.pages[0].extract_text() or ""
                return ""
        except Exception as e:
            print(f"Error reading PDF file {filepath}: {e}")
            return ""
    elif file_extension == '.txt':
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                return file.read()
        except Exception as e:
            print(f"Error reading TXT file {filepath}: {e}")
            return ""
    else:
        print(f"Skipping unsupported file type: {file_extension}")
        return ""

# --- Method 2: Rule-Based Renaming (Free) ---

def generate_descriptive_filename_rule_based(text_content):
    """
    Generates a descriptive filename based on the content using a rule-based approach.

    Args:
        text_content (str): The text content extracted from the file.

    Returns:
        str: A descriptive filename.
    """
    if not text_content or not text_content.strip():
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        return f"unnamed_document_{timestamp}"

    match_title = re.search(r'^(.*?)\n', text_content, re.MULTILINE)
    if match_title:
        title = match_title.group(1).strip()
        if len(title) > 5 and len(title) < 50:
            cleaned_title = re.sub(r'[^a-zA-Z0-9_ -]', '', title)
            return cleaned_title.replace(' ', '_')[:50]

    match_date = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text_content)
    if match_date:
        date_str = match_date.group(1).replace('/', '-')
        return f"document_on_{date_str}"

    first_words = "_".join(text_content.strip().split()[:5])
    cleaned_filename = re.sub(r'[^a-zA-Z0-9_]', '', first_words)
    return cleaned_filename[:50] or f"generic_file_{time.strftime('%Y%m%d')}"

# --- Method 3: OpenAI API Renaming (Requires Key) ---

def get_new_filename_from_openai(text_content):
    """
    Generates a new filename using the OpenAI API based on the file content.
    
    Returns:
        str: A validated and cleaned filename, or a default name if generation fails.
    """
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("Error: OpenAI API key not found. Please set the OPENAI_API_KEY in your .env file.")
        return None

    client = OpenAI(timeout=30.0, api_key=api_key)
    MAX_TOKENS = 4000
    GPT_MODEL = "gpt-3.5-turbo-0125"

    prompt = (
        "You are an assistant that creates descriptive filenames for documents. "
        "Based on the following text, provide a concise filename. "
        "The filename must contain only English letters, numbers, and underscores. "
        "It should be no longer than 50 characters. "
        "Respond with only the filename and nothing else."
    )
    
    try:
        response = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text_content[:MAX_TOKENS]},
            ],
            max_tokens=20,
            temperature=0.3,
        )
        initial_filename = response.choices[0].message.content.strip()
        cleaned_filename = re.sub(r'[^a-zA-Z0-9_]', '_', initial_filename)[:50]
        return cleaned_filename or f"failed_to_name_{time.strftime('%Y%m%d_%H%M%S')}"

    except Exception as e:
        print(f"Error generating filename with OpenAI: {e}")
        return f"failed_to_name_{time.strftime('%Y%m%d_%H%M%S')}"

# --- Main Renaming Function ---

def rename_files_in_directory(directory, method):
    """
    Renames files in a directory using the specified method.
    """
    if not os.path.isdir(directory):
        print(f"Error: The directory '{directory}' does not exist.")
        return

    print(f"Starting file renaming process in '{directory}' using {method} method...")
    
    files_to_process = sorted(
        [f for f in os.listdir(directory) if f.lower().endswith(('.pdf', '.txt'))],
        key=lambda f: os.path.getmtime(os.path.join(directory, f)),
        reverse=True
    )

    if not files_to_process:
        print("No .pdf or .txt files found in the specified directory.")
        return

    for filename in files_to_process:
        filepath = os.path.join(directory, filename)
        file_base, file_extension = os.path.splitext(filename)
        print(f"\nProcessing '{filename}'...")

        text_content = extract_text_from_file(filepath)
        if not text_content:
            print("Skipping this file due to content extraction error.")
            continue
            
        if method == "openai":
            new_base_name = get_new_filename_from_openai(text_content)
            if not new_base_name:
                print("Skipping this file due to API key error or generation failure.")
                continue
        else: # Assumes "rule-based"
            new_base_name = generate_descriptive_filename_rule_based(text_content)

        new_filename = f"{new_base_name}{file_extension}"
        
        counter = 1
        original_new_filename = new_filename
        while os.path.exists(os.path.join(directory, new_filename)):
            new_filename = f"{new_base_name}_{counter}{file_extension}"
            counter += 1
        
        new_filepath = os.path.join(directory, new_filename)
        try:
            os.rename(filepath, new_filepath)
            print(f"Successfully renamed '{filename}' to '{new_filename}'.")
        except OSError as e:
            print(f"Failed to rename '{filename}'. Error: {e}")

def main():
    """Main function to run the file renaming script with a choice of method."""
    directory = input("Please enter the path to the directory with your files: ")

    choice = input("Choose a renaming method:\n1. Free (Rule-Based)\n2. OpenAI (Requires API Key)\nEnter 1 or 2: ")
    
    if choice == '1':
        rename_files_in_directory(directory, "rule-based")
    elif choice == '2':
        rename_files_in_directory(directory, "openai")
    else:
        print("Invalid choice. Please run the script again and enter 1 or 2.")

if __name__ == "__main__":
    main()