import { exec } from 'node:child_process';

/**
 * Inspect git status and uncommitted changes in the workspace.
 */
export async function getGitStatus({ cwd = process.cwd() } = {}) {
  return new Promise((resolve) => {
    exec('git status --short && git branch --show-current', { cwd }, (err, stdout) => {
      if (err) {
        resolve({
          isGitRepo: false,
          output: 'Not a git repository or git command failed.'
        });
      } else {
        const lines = (stdout || '').trim().split('\n');
        const branch = lines.pop() || 'unknown';
        resolve({
          isGitRepo: true,
          branch,
          changes: lines.filter(Boolean),
          output: stdout.trim() || 'Working directory clean.'
        });
      }
    });
  });
}

/**
 * Inspect git diff for the workspace or specific file.
 */
export async function getGitDiff({ filePath = null, staged = false, cwd = process.cwd() } = {}) {
  const fileArg = filePath ? ` -- "${filePath}"` : '';
  const stagedArg = staged ? ' --staged' : '';
  const cmd = `git diff${stagedArg}${fileArg}`;

  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 200000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          error: stderr || err.message,
          diff: ''
        });
      } else {
        resolve({
          success: true,
          diff: stdout.trim() || '(no diff - files match working tree)',
          truncated: stdout.length > 100000
        });
      }
    });
  });
}
