import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  resolveModelProvider,
  fetchAndCategorizeModels,
  promptModelInteractive
} from '../src/harness/model-selector.mjs';

test('resolveModelProvider - maps model prefixes to providers accurately', () => {
  assert.equal(resolveModelProvider('deepseek-chat'), 'deepseek');
  assert.equal(resolveModelProvider('deepseek-reasoner'), 'deepseek');
  assert.equal(resolveModelProvider('intern-s1'), 'internlm');
  assert.equal(resolveModelProvider('intern-s2-0911-web'), 'internlm');
  assert.equal(resolveModelProvider('k2'), 'kimi');
  assert.equal(resolveModelProvider('k1.5'), 'kimi');
  assert.equal(resolveModelProvider('qwen3.7-plus'), 'qwen');
  assert.equal(resolveModelProvider('glm-4.5'), 'zai');
  assert.equal(resolveModelProvider('minimax-m2.7'), 'minimax');
  assert.equal(resolveModelProvider('mimo-flash'), 'mimo');
  assert.equal(resolveModelProvider('hy4-preview-g'), 'hunyuan');
  assert.equal(resolveModelProvider('ERINE-5.1'), 'wenxin');
  assert.equal(resolveModelProvider('gpt-4o'), 'chatgpt');
  assert.equal(resolveModelProvider('unknown-foo'), null);
});

test('fetchAndCategorizeModels - prioritizes active and ready models first', async () => {
  // Mock AuthManager
  const mockAuthManager = {
    getStatus: () => ({
      activeProvider: 'internlm',
      providers: [
        { id: 'internlm', name: 'InternLM', isConfigured: true },
        { id: 'kimi', name: 'Kimi Moonshot', isConfigured: true },
        { id: 'deepseek', name: 'DeepSeek', isConfigured: false },
        { id: 'minimax', name: 'MiniMax', isConfigured: false }
      ]
    })
  };

  const { readyModels, setupNeededModels, allOrdered } = await fetchAndCategorizeModels({
    apiUrl: 'http://127.0.0.1:9999/unreachable',
    authManager: mockAuthManager,
    currentModel: 'intern-s1'
  });

  assert.ok(readyModels.length > 0);
  assert.ok(setupNeededModels.length > 0);

  // Active model is at the very top of ready models and allOrdered
  assert.equal(allOrdered[0].id, 'intern-s1');
  assert.equal(allOrdered[0].isActiveModel, true);
  assert.equal(allOrdered[0].isConfigured, true);

  // All ready models come before any setupNeeded models
  const firstUnconfiguredIdx = allOrdered.findIndex(m => !m.isConfigured);
  const lastConfiguredIdx = allOrdered.findLastIndex(m => m.isConfigured);
  assert.ok(firstUnconfiguredIdx > lastConfiguredIdx, 'Configured models must precede unconfigured models');

  // Verify Kimi k2/k1.5 are in ready models
  const kimiModel = readyModels.find(m => m.id === 'k2' || m.id === 'k1.5');
  assert.ok(kimiModel, 'Configured provider models must be in ready models');

  // Verify DeepSeek is in setupNeeded models
  const deepseekModel = setupNeededModels.find(m => m.id === 'deepseek-reasoner');
  assert.ok(deepseekModel, 'Unconfigured provider models must be in setupNeeded models');
  assert.equal(deepseekModel.isConfigured, false);
});

test('promptModelInteractive - non-TTY prints list and returns null safely', async () => {
  const dummyStdin = new EventEmitter();
  dummyStdin.isTTY = false;
  const dummyStdout = { write: () => {} };

  const models = [
    { id: 'intern-s1', isConfigured: true, isActiveModel: true, providerName: 'InternLM' },
    { id: 'k2', isConfigured: true, isActiveModel: false, providerName: 'Kimi' }
  ];

  const result = await promptModelInteractive({
    models,
    currentModel: 'intern-s1',
    stdin: dummyStdin,
    stdout: dummyStdout
  });

  assert.equal(result, null);
});

test('promptModelInteractive - handles Tab navigation and Enter selection with mock TTY', async () => {
  const mockStdin = new EventEmitter();
  mockStdin.isTTY = true;
  mockStdin.setRawMode = () => {};
  mockStdin.resume = () => {};

  let outputBuffer = '';
  const mockStdout = {
    write: (str) => { outputBuffer += str; }
  };

  const models = [
    { id: 'intern-s1', isConfigured: true, isActiveModel: true, providerName: 'InternLM' },
    { id: 'k2', isConfigured: true, isActiveModel: false, providerName: 'Kimi' },
    { id: 'deepseek-reasoner', isConfigured: false, isActiveModel: false, providerName: 'DeepSeek' }
  ];

  const selectPromise = promptModelInteractive({
    models,
    currentModel: 'intern-s1',
    stdin: mockStdin,
    stdout: mockStdout
  });

  // Initially index 0 ('intern-s1') is selected.
  // Press TAB -> moves to index 1 ('k2')
  mockStdin.emit('keypress', '\t', { name: 'tab', shift: false });

  // Press ENTER -> selects 'k2'
  mockStdin.emit('keypress', '\r', { name: 'return' });

  const chosen = await selectPromise;
  assert.ok(chosen);
  assert.equal(chosen.id, 'k2');
  assert.equal(chosen.isConfigured, true);
});

test('promptModelInteractive - handles Escape cancellation', async () => {
  const mockStdin = new EventEmitter();
  mockStdin.isTTY = true;
  mockStdin.setRawMode = () => {};
  mockStdin.resume = () => {};

  const mockStdout = { write: () => {} };

  const models = [
    { id: 'intern-s1', isConfigured: true, isActiveModel: true, providerName: 'InternLM' }
  ];

  const selectPromise = promptModelInteractive({
    models,
    currentModel: 'intern-s1',
    stdin: mockStdin,
    stdout: mockStdout
  });

  // Press ESC -> cancels
  mockStdin.emit('keypress', '\x1b', { name: 'escape' });

  const chosen = await selectPromise;
  assert.equal(chosen, null);
});
