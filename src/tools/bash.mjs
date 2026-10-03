import { exec } from 'node:child_process';

/**
 * Execute a shell command with timeout and output truncation.
 */
export async function executeBash({ command, cwd = process.cwd(), timeoutMs = 60000, maxOutputBytes = 100000 }) {
  if (!command || typeof command !== 'string') {
    throw new Error('Command must be a non-empty string.');
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = exec(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes * 2,
      shell: '/bin/bash',
      env: {
        ...process.env,
        PAGER: 'cat',
        GIT_PAGER: 'cat'
      }
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      let out = stdout || '';
      let err = stderr || '';

      let truncated = false;
      if (out.length > maxOutputBytes) {
        out = out.slice(0, maxOutputBytes) + `\n... [Output truncated to ${maxOutputBytes} bytes]`;
        truncated = true;
      }
      if (err.length > maxOutputBytes) {
        err = err.slice(0, maxOutputBytes) + `\n... [Error truncated to ${maxOutputBytes} bytes]`;
        truncated = true;
      }

      const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      const killed = error ? Boolean(error.killed) : false;

      resolve({
        command,
        cwd,
        exitCode,
        stdout: out,
        stderr: err,
        durationMs,
        killed,
        truncated,
        success: exitCode === 0 && !killed
      });
    });
  });
}
