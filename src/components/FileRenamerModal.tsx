import { useState, useEffect } from 'react';
import Button, { ButtonSize } from '../ui/Button';
import { RenamerResult, smartRenameFiles, getRenamerSchemes } from '../ipc';

interface FileRenamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
}

const FileRenamingModal: React.FC<FileRenamingModalProps> = ({
  isOpen,
  onClose,
  folderPath,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renamerResult, setRenamerResult] = useState<RenamerResult | null>(null);
  const [schemes, setSchemes] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('rule-based');
  const [selectedScheme, setSelectedScheme] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchSchemes() {
      const fetchedSchemes = await getRenamerSchemes();
      setSchemes(fetchedSchemes);
      setSelectedScheme(fetchedSchemes[0]);
    }
    fetchSchemes();
  }, []);

  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  useEffect(() => {
    setShowApiKeyInput(selectedMethod === 'openai');
  }, [selectedMethod]);

  const handleRenameClick = async () => {
    if (selectedMethod === 'openai' && !openaiKey) {
      alert('Please enter your OpenAI API key');
      return;
    }

    setIsRenaming(true);
    setProgress(0);
    setRenamerResult(null);

    const config = {
      method: selectedMethod as 'rule-based' | 'openai',
      scheme: selectedScheme,
      ...(selectedMethod === 'openai' && { openai_key: openaiKey }),
    };

    try {
      const result = await smartRenameFiles(folderPath, config);
      setRenamerResult(result);

      // Simulate progress for a better user experience
      const totalFiles = result.renamed_files.length;
      let processedFiles = 0;
      const interval = setInterval(() => {
        if (processedFiles < totalFiles) {
          processedFiles += 1;
          setProgress((processedFiles / totalFiles) * 100);
        } else {
          clearInterval(interval);
          setIsRenaming(false);
        }
      }, 100);
    } catch (error) {
      setRenamerResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred during renaming',
        renamed_files: [],
      });
      setIsRenaming(false);
    }
  };

  const handleClose = () => {
    onClose();
    setIsRenaming(false);
    setProgress(0);
    setRenamerResult(null);
  };

  return (
    isOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg">
          <h3 className="text-lg font-semibold">AI-Powered File Renaming</h3>
          <p className="text-sm text-gray-600">Rename files in the folder using a renaming scheme.</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Renaming Method</label>
              <select className="mt-1 block w-full rounded border px-2 py-1" value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value)}>
                <option value="rule-based">Free (Rule-Based)</option>
                <option value="openai">OpenAI (Requires API Key)</option>
              </select>
            </div>

            {showApiKeyInput && (
              <div>
                <label className="block text-sm">OpenAI API Key</label>
                <input type="password" className="mt-1 block w-full rounded border px-2 py-1" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
              </div>
            )}

            <div>
              <label className="block text-sm">Renaming Scheme</label>
              <select className="mt-1 block w-full rounded border px-2 py-1" value={selectedScheme} onChange={(e) => setSelectedScheme(e.target.value)}>
                {schemes.map((scheme, i) => <option key={i} value={scheme}>{scheme}</option>)}
              </select>
            </div>

            {isRenaming && (
              <div>
                <label className="block text-sm">Renaming in progress...</label>
                <progress className="w-full" value={progress} max={100} />
              </div>
            )}

            {renamerResult && (
              <div>
                <p className="font-bold">Result:</p>
                <p className={renamerResult.success ? 'text-green-500' : 'text-red-500'}>{renamerResult.message}</p>
                {renamerResult.renamed_files.length > 0 && (
                  <ul className="list-disc list-inside mt-2 text-sm text-gray-600">
                    {renamerResult.renamed_files.map((file: string, index: number) => (
                      <li key={index}>{file}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-2">
            <Button onClick={handleClose} size={ButtonSize.Small}>Close</Button>
            <Button onClick={handleRenameClick} size={ButtonSize.Small}>Run Renamer</Button>
          </div>
        </div>
      </div>
    ) : null
  );
};

export default FileRenamingModal;