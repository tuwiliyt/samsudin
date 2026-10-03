import fs from 'node:fs';
import path from 'node:path';

/**
 * Search directory for files matching substring or extension pattern.
 */
export async function globFiles({
  pattern = '*',
  dir = process.cwd(),
  maxResults = 150,
  ignoreDirs = ['node_modules', '.git', 'dist', '.samsudin']
}) {
  const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  // Convert simple wildcard like "*.js" or "src/**" to RegExp
  let regex = null;
  if (pattern && pattern !== '*') {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    regex = new RegExp(escaped, 'i');
  }

  const results = [];

  function walk(currentDir) {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(resolvedDir, fullPath);

      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!regex || regex.test(relPath) || regex.test(entry.name)) {
          results.push(relPath);
        }
      }
    }
  }

  walk(resolvedDir);

  return {
    pattern,
    totalFiles: results.length,
    files: results,
    truncated: results.length >= maxResults
  };
}
