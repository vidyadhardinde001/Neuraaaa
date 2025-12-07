/**
 * Voice Command Patterns
 * Defines all possible spoken variations for voice commands.
 * Each pattern is a regex that matches multiple ways of saying the same thing.
 */

export interface VoicePattern {
  action: 'create_file' | 'create_folder' | 'delete_file' | 'delete_folder' | 'rename_file';
  patterns: RegExp[];
  paramCount: number; // number of capture groups
  examples: string[]; // user-friendly examples
}

export const VOICE_PATTERNS: VoicePattern[] = [
  // CREATE FILE variations (11 patterns)
  {
    action: 'create_file',
    patterns: [
      /^create\s+(?:a\s+)?file\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^make\s+(?:a\s+)?file\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^new\s+file\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^add\s+(?:a\s+)?file\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^touch\s+(.+)$/i,
      /^write\s+(?:a\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^generate\s+(?:a\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^create\s+(?:new\s+)?(?:file\s+)?named\s+(.+)$/i,
      /^make\s+(?:new\s+)?(?:file\s+)?called\s+(.+)$/i,
      /^open\s+(?:new\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^start\s+(?:a\s+)?file\s+named\s+(.+)$/i,
    ],
    paramCount: 1,
    examples: [
      'create a file myfile dot txt',
      'make file report',
      'new file notes dot md',
      'add a file data',
      'touch temp',
      'write a file document dot pdf',
      'generate file config dot json',
      'create file named backup',
      'make new file called archive',
      'open new file named readme',
      'start a file named notes',
    ],
  },

  // CREATE FOLDER variations (11 patterns)
  {
    action: 'create_folder',
    patterns: [
      /^create\s+(?:a\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^make\s+(?:a\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^new\s+(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^add\s+(?:a\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^mkdir\s+(.+)$/i,
      /^create\s+directory\s+(?:named?\s+)?(.+)$/i,
      /^make\s+directory\s+(?:named?\s+)?(.+)$/i,
      /^build\s+(?:a\s+)?folder\s+named\s+(.+)$/i,
      /^setup\s+(?:folder|directory)\s+(?:called?\s+)?(.+)$/i,
      /^create\s+new\s+(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^initialize\s+folder\s+(?:named?\s+)?(.+)$/i,
    ],
    paramCount: 1,
    examples: [
      'create a folder documents',
      'make folder downloads',
      'new directory projects',
      'add a folder backups',
      'mkdir temp',
      'create directory named archive',
      'make directory called old files',
      'build a folder named images',
      'setup folder for backups',
      'create new folder named workspace',
      'initialize folder for data',
    ],
  },

  // DELETE FILE variations (11 patterns)
  {
    action: 'delete_file',
    patterns: [
      /^delete\s+(?:the\s+)?(?:file\s+)?(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^remove\s+(?:the\s+)?(?:file\s+)?(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^erase\s+(?:the\s+)?(?:file\s+)?(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^delete\s+file\s+(.+)$/i,
      /^rm\s+(.+)$/i,
      /^discard\s+(?:the\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^destroy\s+(?:file\s+)?(?:named?\s+)?(.+)$/i,
      /^purge\s+(?:the\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^unlink\s+(.+)$/i,
      /^clear\s+(?:the\s+)?file\s+(?:named?\s+)?(.+)$/i,
      /^trash\s+(?:file\s+)?(?:named?\s+)?(.+)$/i,
    ],
    paramCount: 1,
    examples: [
      'delete file myfile dot txt',
      'remove the file report',
      'erase old notes',
      'delete file backup',
      'rm temp',
      'discard the file named junk',
      'destroy file config',
      'purge the file data dot json',
      'unlink temp file',
      'clear the file named archive',
      'trash unwanted file',
    ],
  },

  // DELETE FOLDER variations (11 patterns)
  {
    action: 'delete_folder',
    patterns: [
      /^delete\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^remove\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^erase\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(?:called?\s+)?(.+)$/i,
      /^delete\s+(?:folder|directory)\s+(.+)$/i,
      /^rmdir\s+(.+)$/i,
      /^discard\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^destroy\s+(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^purge\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^clear\s+(?:the\s+)?(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^trash\s+(?:folder|directory)\s+(?:named?\s+)?(.+)$/i,
      /^remove\s+directory\s+(?:named?\s+)?(.+)$/i,
    ],
    paramCount: 1,
    examples: [
      'delete folder documents',
      'remove the directory old files',
      'erase unused folder',
      'delete folder downloads',
      'rmdir temp',
      'discard the folder named archive',
      'destroy directory backup',
      'purge the folder old data',
      'clear the directory named cache',
      'trash folder named junk',
      'remove directory called temp',
    ],
  },

  // RENAME FILE variations (11 patterns)
  {
    action: 'rename_file',
    patterns: [
      /^rename\s+(?:the\s+)?(?:file\s+)?(?:named?\s+)?(?:called?\s+)?(.+?)\s+(?:to|as|into)\s+(.+)$/i,
      /^change\s+(?:the\s+)?(?:file\s+)?(?:named?\s+)?(?:called?\s+)?(.+?)\s+(?:to|as|into)\s+(.+)$/i,
      /^rename\s+(?:file\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i,
      /^move\s+(?:the\s+)?(?:file\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i,
      /^rename\s+(.+?)\s+(?:to|as|into)\s+(.+)$/i,
      /^call\s+(?:the\s+)?(?:file\s+)?(.+?)\s+(?:as|instead)\s+(.+)$/i,
      /^rename\s+(?:file\s+)?(?:named\s+)?(.+?)\s+(?:to|as)\s+(?:named\s+)?(.+)$/i,
      /^transform\s+(?:file\s+)?(.+?)\s+(?:to|into)\s+(.+)$/i,
      /^change\s+name\s+of\s+(.+?)\s+(?:to|into)\s+(.+)$/i,
      /^alter\s+(?:file\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i,
      /^rename\s+(?:the\s+)?(.+?)\s+(?:to)\s+(?:the\s+)?(.+)$/i,
    ],
    paramCount: 2,
    examples: [
      'rename old dot txt to new dot txt',
      'change file report to summary',
      'rename backup to archive',
      'move file data to processed data',
      'rename myfile to myfile backup',
      'call the file as final version',
      'rename file named temp to permanent',
      'transform backup to restored',
      'change name of old to new',
      'alter file to updated version',
      'rename the archive to final archive',
    ],
  },
];

/**
 * Get examples for a specific command action
 */
export function getCommandExamples(action: string): string[] {
  const pattern = VOICE_PATTERNS.find(p => p.action === action);
  return pattern?.examples || [];
}

/**
 * Try to match input against all voice patterns.
 * Returns { action, params } if match found, null otherwise.
 */
export function matchVoicePattern(
  input: string
): { action: string; params: string[] } | null {
  for (const pattern of VOICE_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = input.match(regex);
      if (match) {
        // Extract capture groups (skip index 0 which is the full match)
        const params = match.slice(1);
        return {
          action: pattern.action,
          params,
        };
      }
    }
  }
  return null;
}
