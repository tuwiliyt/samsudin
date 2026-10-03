import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkspacePath } from '../utils/path-resolver.mjs';

/**
 * View contents of a file with line numbers and optional line slice.
 */
export async function viewFile({ filePath, startLine = 1, endLine = null, maxLines = 800, cwd = process.cwd() }) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be provided.');
  }

  const resolvedPath = resolveWorkspacePath(filePath, cwd);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${filePath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  const actualStart = Math.max(1, parseInt(startLine, 10) || 1);
  const requestedEnd = endLine ? parseInt(endLine, 10) : totalLines;
  const actualEnd = Math.min(totalLines, Math.min(requestedEnd, actualStart + maxLines - 1));

  const slice = lines.slice(actualStart - 1, actualEnd);
  const formatted = slice.map((line, idx) => {
    const lineNum = actualStart + idx;
    return `${lineNum.toString().padStart(4, ' ')}: ${line}`;
  }).join('\n');

  return {
    filePath: resolvedPath,
    totalLines,
    startLine: actualStart,
    endLine: actualEnd,
    content: formatted,
    truncated: actualEnd < totalLines
  };
}
