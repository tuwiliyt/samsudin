import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively search for a pattern in text files within a directory.
 */
export async function grepFiles({
  pattern,
  dir = process.cwd(),
  caseSensitive = false,
  maxResults = 100,
  ignoreDirs = ['node_modules', '.git', 'dist', '.samsudin']
}) {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('pattern must be specified.');
  }

  const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
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

      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        // Skip huge binary or minified files (> 2MB)
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue;

          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;
            const line = lines[i];
            if (regex.test(line)) {
              results.push({
                filePath: path.relative(resolvedDir, fullPath),
                lineNumber: i + 1,
                line: line.trim()
              });
            }
            regex.lastIndex = 0; // Reset state for global regex
          }
        } catch {
          // ignore unreadable/binary files
        }
      }
    }
  }

  walk(resolvedDir);

  return {
    pattern,
    totalMatches: results.length,
    matches: results,
    truncated: results.length >= maxResults
  };
}
