import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkspacePath } from '../utils/path-resolver.mjs';

/**
 * Write or overwrite a file. Automatically creates parent directories.
 */
export async function writeFile({ filePath, content = '', overwrite = true, cwd = process.cwd() }) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be provided.');
  }

  const resolvedPath = resolveWorkspacePath(filePath, cwd);
  const exists = fs.existsSync(resolvedPath);

  if (exists && !overwrite) {
    throw new Error(`File already exists and overwrite is false: ${filePath}`);
  }

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, content, 'utf-8');
  const linesCount = content ? content.split('\n').length : 0;
  const byteCount = Buffer.byteLength(content, 'utf-8');

  return {
    filePath: resolvedPath,
    created: !exists,
    bytesWritten: byteCount,
    linesCount,
    success: true
  };
}
