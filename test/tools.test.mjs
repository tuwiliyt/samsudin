import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeBash } from '../src/tools/bash.mjs';
import { viewFile } from '../src/tools/view-file.mjs';
import { writeFile } from '../src/tools/write-file.mjs';
import { replaceFileContent } from '../src/tools/replace-file.mjs';
import { grepFiles } from '../src/tools/grep.mjs';
import { globFiles } from '../src/tools/glob.mjs';

test('Tools - bash execution', async () => {
  const result = await executeBash({ command: 'echo "hello samsudin"' });
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes('hello samsudin'));
  assert.equal(result.success, true);
});

test('Tools - write_file, view_file, and replace_file_content', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-test-'));
  const testFile = path.join(tmpDir, 'test.txt');

  try {
    // 1. Write file
    const writeRes = await writeFile({
      filePath: testFile,
      content: 'line 1: apples\nline 2: oranges\nline 3: bananas\n'
    });
    assert.equal(writeRes.success, true);
    assert.ok(fs.existsSync(testFile));

    // 2. View file
    const viewRes = await viewFile({
      filePath: testFile,
      startLine: 2,
      endLine: 3
    });
    assert.equal(viewRes.startLine, 2);
    assert.equal(viewRes.endLine, 3);
    assert.ok(viewRes.content.includes('oranges'));
    assert.ok(viewRes.content.includes('bananas'));

    // 3. Replace content
    const repRes = await replaceFileContent({
      filePath: testFile,
      targetContent: 'line 2: oranges',
      replacementContent: 'line 2: mangos'
    });
    assert.equal(repRes.success, true);
    assert.equal(repRes.occurrencesReplaced, 1);

    const updated = fs.readFileSync(testFile, 'utf-8');
    assert.ok(updated.includes('line 2: mangos'));
    assert.ok(!updated.includes('line 2: oranges'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Tools - grep and glob', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-grep-'));
  const subFile1 = path.join(tmpDir, 'sub1', 'alpha.js');
  const subFile2 = path.join(tmpDir, 'sub2', 'beta.txt');

  try {
    await writeFile({ filePath: subFile1, content: 'const SECRET_KEY = "XYZ123";\n' });
    await writeFile({ filePath: subFile2, content: 'just a normal beta file\n' });

    // Glob
    const globRes = await globFiles({ dir: tmpDir, pattern: '*.js' });
    assert.equal(globRes.totalFiles, 1);
    assert.ok(globRes.files[0].endsWith('alpha.js'));

    // Grep
    const grepRes = await grepFiles({ dir: tmpDir, pattern: 'SECRET_KEY' });
    assert.equal(grepRes.totalMatches, 1);
    assert.equal(grepRes.matches[0].lineNumber, 1);
    assert.ok(grepRes.matches[0].line.includes('SECRET_KEY'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Tools - Path resolution and Python script generation/execution workflow', async () => {
  const { resolveWorkspacePath } = await import('../src/utils/path-resolver.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-pyflow-'));

  try {
    // 1. Path resolution checks
    assert.equal(resolveWorkspacePath('/tmp/test.csv'), '/tmp/test.csv');
    assert.equal(resolveWorkspacePath('relative/data.json', tmpDir), path.resolve(tmpDir, 'relative/data.json'));
    assert.ok(resolveWorkspacePath('~/test.txt').startsWith(os.homedir()));
    assert.equal(resolveWorkspacePath(' "quoted/path.txt" ', tmpDir), path.resolve(tmpDir, 'quoted/path.txt'));

    // 2. User provides a data file at a specific path
    const dataFilePath = path.join(tmpDir, 'dataset.json');
    fs.writeFileSync(dataFilePath, JSON.stringify({ numbers: [10, 20, 30, 40] }));

    // 3. Samsudin reads the user file using viewFile (supports relative or absolute)
    const viewRes = await viewFile({ filePath: dataFilePath, cwd: tmpDir });
    assert.ok(viewRes.content.includes('10,20,30,40'));

    // 4. Samsudin writes a Python script to process the user file
    const pyScriptPath = path.join(tmpDir, 'calc_average.py');
    const pyCode = `import json
with open('${dataFilePath}', 'r') as f:
    data = json.load(f)
avg = sum(data['numbers']) / len(data['numbers'])
print(f"AVERAGE={avg}")
`;
    await writeFile({ filePath: pyScriptPath, content: pyCode, cwd: tmpDir });
    assert.ok(fs.existsSync(pyScriptPath));

    // 5. Samsudin runs the Python script via bash
    const bashRes = await executeBash({ command: `python3 ${pyScriptPath}`, cwd: tmpDir });
    assert.equal(bashRes.exitCode, 0);
    assert.ok(bashRes.stdout.includes('AVERAGE=25.0'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

