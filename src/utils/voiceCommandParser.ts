/**
 * Voice Command Parser
 * Parses fixed voice commands and extracts parameters
 * Uses voicePatterns.ts for flexible pattern matching.
 */

import { matchVoicePattern } from './voicePatterns';

export interface ParsedCommand {
  action: 'create_file' | 'create_folder' | 'delete_file' | 'delete_folder' | 'rename_file' | 'unknown';
  target?: string; // filename or folder name
  newName?: string; // for rename operations
  error?: string;
}

/** Normalize spoken separators like 'dot', 'period', 'full stop' to a dot. */
function normalizeDots(input: string): string {
  let s = input.toLowerCase().trim();
  
  // First, remove trailing punctuation BEFORE converting spoken dots
  // (so "create a file abcd dot txt." becomes "create a file abcd dot txt")
  s = s.replace(/[.,!?;:]+$/g, '');
  
  // Now convert spoken separators to dots
  s = s
    .replace(/\s+(?:dot|period|full stop)\s+/g, '.')   // " dot "
    .replace(/\s+(?:dot|period|full stop)$/g, '.')     // " dot" at end
    .replace(/^(?:dot|period|full stop)\s+/g, '.')     // "dot " at start
    .replace(/\s*\.\s*/g, '.')                         // fix spaces around dots
    .replace(/\s+/g, ' ')                              // collapse spaces
    .trim();
  return s;
}

export function parseVoiceCommand(input: string): ParsedCommand {
  const normalizedInput = normalizeDots(input);
  
  // Try to match against known patterns
  const match = matchVoicePattern(normalizedInput);
  
  if (!match) {
    return {
      action: 'unknown',
      error: `Could not parse command: "${input}". Try: "create a file [name]", "delete file [name]", "rename [old] to [new]", etc.`,
    };
  }

  const { action, params } = match;

  switch (action) {
    case 'create_file':
    case 'create_folder':
    case 'delete_file':
    case 'delete_folder':
      return {
        action: action as any,
        target: params[0]?.trim(),
      };

    case 'rename_file':
      return {
        action: 'rename_file',
        target: params[0]?.trim(),
        newName: params[1]?.trim(),
      };

    default:
      return {
        action: 'unknown',
        error: `Unknown action: ${action}`,
      };
  }
}

/**
 * Find a file in a DirectoryContent[] list. This supports several shapes:
 * - { meta: { name, path, is_dir } }
 * - { File: { name, path } }
 * - { Directory: { name, path } }
 */
export function findFileInList(fileName: string, files: any[]): any | null {
  if (!files || files.length === 0) return null;
  const lowered = fileName.toLowerCase();

  // exact match
  const exact = files.find(f => {
    const meta = f?.meta || f?.File || f?.Directory || f;
    return (meta?.name || '').toLowerCase() === lowered;
  });
  if (exact) return exact;

  // partial contains
  const partial = files.find(f => {
    const meta = f?.meta || f?.File || f?.Directory || f;
    return (meta?.name || '').toLowerCase().includes(lowered);
  });
  return partial || null;
}
