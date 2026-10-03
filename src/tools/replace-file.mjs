import fs from 'node:fs';
import path from 'node:path';

/**
 * Replace a specific block of text in a file.
 */
export async function replaceFileContent({ filePath, targetContent, replacementContent, allowMultiple = false }) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be provided.');
  }
  if (targetContent === undefined || targetContent === null) {
    throw new Error('targetContent must be specified.');
  }
  if (replacementContent === undefined || replacementContent === null) {
    throw new Error('replacementContent must be specified.');
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const original = fs.readFileSync(resolvedPath, 'utf-8');

  // Check occurrence count
  let occurrences = 0;
  let pos = 0;
  while ((pos = original.indexOf(targetContent, pos)) !== -1) {
    occurrences++;
    pos += targetContent.length;
  }

  if (occurrences === 0) {
    throw new Error(`Target content not found in ${filePath}. Ensure exact whitespace and line match.`);
  }

  if (occurrences > 1 && !allowMultiple) {
    throw new Error(
      `Target content appears ${occurrences} times in ${filePath}. Provide a more specific target block or enable allowMultiple=true.`
    );
  }

  let updated;
  if (allowMultiple) {
    updated = original.replaceAll(targetContent, replacementContent);
  } else {
    updated = original.replace(targetContent, replacementContent);
  }

  fs.writeFileSync(resolvedPath, updated, 'utf-8');

  return {
    filePath: resolvedPath,
    occurrencesReplaced: occurrences,
    success: true
  };
}
