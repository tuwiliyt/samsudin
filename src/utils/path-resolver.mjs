import path from 'node:path';
import os from 'node:os';

/**
 * Robust path resolver for Samsudin tools.
 * Handles:
 * - Absolute paths (/content/data.txt)
 * - Home-directory paths (~/data.txt, ~)
 * - Relative paths (./data.txt, data/input.csv)
 * - Quoted or whitespace-padded path strings
 */
export function resolveWorkspacePath(filePath, cwd = process.cwd()) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('A valid filePath string must be provided.');
  }

  // Strip leading/trailing whitespace and surrounding quotes
  let cleaned = filePath.trim().replace(/^['"]|['"]$/g, '');

  // Handle home directory expansion
  if (cleaned === '~') {
    return os.homedir();
  }
  if (cleaned.startsWith('~/') || cleaned.startsWith('~\\')) {
    return path.join(os.homedir(), cleaned.slice(2));
  }

  // Handle absolute vs relative
  if (path.isAbsolute(cleaned)) {
    return path.normalize(cleaned);
  }

  return path.resolve(cwd || process.cwd(), cleaned);
}
