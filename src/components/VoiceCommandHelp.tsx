import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CommandExample {
  category: string;
  examples: string[];
}

const COMMAND_EXAMPLES: CommandExample[] = [
  {
    category: 'Create File',
    examples: [
      'create a file myfile dot txt',
      'make file report dot pdf',
      'new file notes',
      'touch data dot json',
    ],
  },
  {
    category: 'Create Folder',
    examples: [
      'create a folder my project',
      'make directory documents',
      'new folder downloads',
      'mkdir backup',
    ],
  },
  {
    category: 'Delete File',
    examples: [
      'delete file myfile dot txt',
      'remove the report dot pdf',
      'erase notes',
      'rm temp dot txt',
    ],
  },
  {
    category: 'Delete Folder',
    examples: [
      'delete folder my project',
      'remove directory documents',
      'erase the old files',
      'rmdir backup',
    ],
  },
  {
    category: 'Rename File',
    examples: [
      'rename old dot txt to new dot txt',
      'rename file report to summary',
      'change file data dot json to backup dot json',
      'rename myfile to archive',
    ],
  },
];

export default function VoiceCommandHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      {/* Help button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="View voice command examples"
        className="p-2 rounded-full transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"
      >
        <span className="text-xs font-semibold">?</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 p-4 border border-gray-200 max-h-[60vh] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4 text-gray-800">Voice Command Examples</h3>

          <div className="space-y-4">
            {COMMAND_EXAMPLES.map((group, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-3">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                  {group.category}
                </h4>
                <ul className="space-y-1">
                  {group.examples.map((example, eIdx) => (
                    <li
                      key={eIdx}
                      className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded font-mono"
                    >
                      "{example}"
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Say "dot" for file extensions (e.g., "myfile dot txt").
              You can also use "period" or "full stop" instead of "dot".
            </p>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
