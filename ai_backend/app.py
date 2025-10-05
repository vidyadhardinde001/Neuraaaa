from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from ai_utils import get_file_content, process_file_with_gemini

app = Flask(__name__)
CORS(app)
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

@app.route('/ai-summary', methods=['POST'])
def ai_summary():
    file_path = request.json.get('file_path')
    content, error = get_file_content(file_path)
    if error:
        return jsonify({'error': error}), 400
    summary, _, err = process_file_with_gemini(content, api_key)
    if err:
        return jsonify({'error': err}), 500
    return jsonify({'summary': summary})

@app.route('/ai-rename', methods=['POST'])
def ai_rename():
    file_path = request.json.get('file_path')
    content, error = get_file_content(file_path)
    if error:
        return jsonify({'error': error}), 400
    _, suggested_name, err = process_file_with_gemini(content, api_key)
    if err:
        return jsonify({'error': err}), 500
    return jsonify({'suggested_name': suggested_name})


@app.route('/rename-file', methods=['POST'])
def http_rename_file():
    data = request.json or {}
    old_path = data.get('old_path')
    new_path = data.get('new_path')
    if not old_path or not new_path:
        return jsonify({'error': 'old_path and new_path are required'}), 400
    # Prevent directory traversal and ensure paths exist
    try:
        if not os.path.exists(old_path):
            return jsonify({'error': 'old_path does not exist'}), 400
        # create parent dir for new_path if missing? For safety, require same directory
        old_dir = os.path.dirname(os.path.abspath(old_path))
        new_dir = os.path.dirname(os.path.abspath(new_path))
        if os.path.normcase(old_dir) != os.path.normcase(new_dir):
            return jsonify({'error': 'renames must stay within the same directory'}), 400

        os.rename(old_path, new_path)
        return jsonify({'ok': True, 'new_path': new_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
