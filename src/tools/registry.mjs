import { executeBash } from './bash.mjs';
import { viewFile } from './view-file.mjs';
import { writeFile } from './write-file.mjs';
import { replaceFileContent } from './replace-file.mjs';
import { grepFiles } from './grep.mjs';
import { globFiles } from './glob.mjs';

export const TOOL_DEFINITIONS = [
  {
    name: 'bash',
    description: 'Execute a bash shell command in the workspace. Returns exitCode, stdout, stderr, and execution duration.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The exact bash command to execute.'
        },
        timeoutMs: {
          type: 'number',
          description: 'Optional execution timeout in milliseconds (default 60000ms).'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'view_file',
    description: 'View the contents of a file with line numbers and optional line range pagination.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to inspect.'
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed, inclusive).'
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (inclusive).'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with provided content.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to create or overwrite.'
        },
        content: {
          type: 'string',
          description: 'Full text content to write.'
        },
        overwrite: {
          type: 'boolean',
          description: 'Whether to allow overwriting if file already exists (default true).'
        }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'replace_file_content',
    description: 'Edit an existing file by replacing an exact, unique target block with replacement content.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to modify.'
        },
        targetContent: {
          type: 'string',
          description: 'The exact character sequence to replace, preserving indentations.'
        },
        replacementContent: {
          type: 'string',
          description: 'The new drop-in replacement text.'
        },
        allowMultiple: {
          type: 'boolean',
          description: 'Whether to allow replacing multiple occurrences (default false).'
        }
      },
      required: ['filePath', 'targetContent', 'replacementContent']
    }
  },
  {
    name: 'grep',
    description: 'Search for text or regex patterns across workspace files.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern or search string.'
        },
        dir: {
          type: 'string',
          description: 'Directory to search within (default current directory).'
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case sensitive matching (default false).'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern or filename in the directory tree.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob or filename pattern (e.g. "*.js", "test/**").'
        },
        dir: {
          type: 'string',
          description: 'Directory to scan (default current directory).'
        }
      },
      required: []
    }
  },
  {
    name: 'git_status',
    description: 'Check the git status of the current workspace, including active branch and modified files.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_diff',
    description: 'View uncommitted changes or file diffs using git diff.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Optional file path to limit the diff to a single file.'
        },
        staged: {
          type: 'boolean',
          description: 'Whether to view staged changes (default false).'
        }
      },
      required: []
    }
  }
];

export async function dispatchToolCall(toolName, args = {}, context = {}) {
  const cwd = context.cwd || process.cwd();

  switch (toolName) {
    case 'bash':
      return await executeBash({
        command: args.command,
        cwd,
        timeoutMs: args.timeoutMs || 60000
      });
    case 'view_file':
      return await viewFile({
        filePath: args.filePath,
        startLine: args.startLine,
        endLine: args.endLine
      });
    case 'write_file':
      return await writeFile({
        filePath: args.filePath,
        content: args.content,
        overwrite: args.overwrite !== false
      });
    case 'replace_file_content':
      return await replaceFileContent({
        filePath: args.filePath,
        targetContent: args.targetContent,
        replacementContent: args.replacementContent,
        allowMultiple: Boolean(args.allowMultiple)
      });
    case 'grep':
      return await grepFiles({
        pattern: args.pattern,
        dir: args.dir ? args.dir : cwd,
        caseSensitive: Boolean(args.caseSensitive)
      });
    case 'glob':
      return await globFiles({
        pattern: args.pattern,
        dir: args.dir ? args.dir : cwd
      });
    case 'git_status': {
      const { getGitStatus } = await import('./git-tools.mjs');
      return await getGitStatus({ cwd });
    }
    case 'git_diff': {
      const { getGitDiff } = await import('./git-tools.mjs');
      return await getGitDiff({
        filePath: args.filePath,
        staged: Boolean(args.staged),
        cwd
      });
    }
    default:
      throw new Error(`Unknown tool: ${toolName}. Available tools: ${TOOL_DEFINITIONS.map(t => t.name).join(', ')}`);
  }
}
