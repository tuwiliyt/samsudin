import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AuthManager } from '../src/auth/auth-manager.mjs';
import { PROVIDERS_META } from '../src/auth/provider-snippets.mjs';

test('AuthManager - sets single provider and maintains isolation', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-auth-test-'));
  try {
    const mgr = new AuthManager(tmpDir);
    mgr.credentialsFile = path.resolve(tmpDir, 'credentials.json');
    mgr.globalDir = tmpDir;

    // Initially empty
    const init = mgr.getStatus();
    assert.equal(init.providers.every(p => !p.isConfigured), true);

    // Set only MiniMax
    mgr.setProvider('minimax', { token: 'sample-minimax-jwt' });
    const afterMiniMax = mgr.getStatus();
    const mm = afterMiniMax.providers.find(p => p.id === 'minimax');
    const ds = afterMiniMax.providers.find(p => p.id === 'deepseek');

    assert.equal(mm.isConfigured, true);
    assert.equal(ds.isConfigured, false); // Other providers remain unconfigured!
    assert.equal(afterMiniMax.activeProvider, 'minimax');

    // Switch active
    mgr.setProvider('deepseek', { token: 'sample-ds-token' });
    mgr.setActiveProvider('deepseek');
    assert.equal(mgr.getStatus().activeProvider, 'deepseek');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('AuthManager - imports credentials from JSON file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-import-test-'));
  try {
    const mgr = new AuthManager(tmpDir);
    mgr.credentialsFile = path.resolve(tmpDir, 'credentials.json');
    mgr.globalDir = tmpDir;

    const sampleExport = path.resolve(tmpDir, 'exported.json');
    fs.writeFileSync(sampleExport, JSON.stringify({
      providers: {
        internlm: { token: 'tok-internlm' },
        qwen: { token: 'tok-qwen' }
      }
    }));

    const res = mgr.importCredentialsFile(sampleExport);
    assert.equal(res.importedCount, 2);
    assert.ok(res.importedKeys.includes('internlm'));
    assert.ok(res.importedKeys.includes('qwen'));

    const st = mgr.getStatus();
    assert.equal(st.providers.find(p => p.id === 'internlm').isConfigured, true);
    assert.equal(st.providers.find(p => p.id === 'qwen').isConfigured, true);
    assert.equal(st.providers.find(p => p.id === 'chatgpt').isConfigured, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('PROVIDERS_META - provides snippets and instructions for all 10 providers', () => {
  const keys = Object.keys(PROVIDERS_META);
  assert.equal(keys.length, 10);
  keys.forEach(k => {
    const meta = PROVIDERS_META[k];
    assert.ok(meta.name);
    assert.ok(meta.url.startsWith('https://'));
    assert.ok(meta.consoleSnippet);
    assert.ok(meta.instruction);
  });
});
