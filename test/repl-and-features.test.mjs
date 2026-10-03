import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/config/config-manager.mjs';
import { SessionManager } from '../src/harness/session-manager.mjs';
import { SamsudinREPL } from '../src/harness/repl.mjs';
import { getGitStatus, getGitDiff } from '../src/tools/git-tools.mjs';

test('ConfigManager - loads default and persists local config', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-cfg-'));
  try {
    const mgr = new ConfigManager(tmpDir);
    const initial = mgr.loadConfig();
    assert.equal(initial.defaultModel, 'ERINE-5.1');

    mgr.saveLocalConfig({ defaultModel: 'intern-s1', yolo: true });
    const updated = mgr.loadConfig();
    assert.equal(updated.defaultModel, 'intern-s1');
    assert.equal(updated.yolo, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SessionManager - records turns with token usage and cost savings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-sess-'));
  try {
    const sm = new SessionManager(tmpDir);
    sm.recordTurn('Task 1', 'Answer 1', [{ name: 'bash' }], {
      promptTokens: 1000,
      completionTokens: 200,
      totalTokens: 1200
    });
    sm.recordTurn('Task 2', 'Answer 2', [{ name: 'view_file' }, { name: 'write_file' }], {
      promptTokens: 1500,
      completionTokens: 300,
      totalTokens: 1800
    });

    const stats = sm.getStatsSummary();
    assert.equal(stats.turns, 2);
    assert.equal(stats.toolCallsCount, 3);
    assert.equal(stats.toolsUsed.bash, 1);
    assert.equal(stats.toolsUsed.write_file, 1);
    assert.equal(stats.usage.promptTokens, 2500);
    assert.equal(stats.usage.completionTokens, 500);
    assert.equal(stats.usage.totalTokens, 3000);
    assert.ok(stats.usage.savingsUsd > 0);
    assert.ok(fs.existsSync(stats.sessionFile));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SamsudinREPL - handles complete slash commands suite', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samsudin-repl-'));
  try {
    const repl = new SamsudinREPL({ cwd: tmpDir, model: 'intern-s1' });

    // /help
    assert.equal(await repl.handleSlashCommand('/help'), true);

    // /usage & /cost
    assert.equal(await repl.handleSlashCommand('/usage'), true);
    assert.equal(await repl.handleSlashCommand('/cost'), true);

    // /tokens
    assert.equal(await repl.handleSlashCommand('/tokens'), true);

    // /model (query active)
    assert.equal(await repl.handleSlashCommand('/model'), true);

    // /model (switch model)
    assert.equal(await repl.handleSlashCommand('/model k1.5'), true);
    assert.equal(repl.model, 'k1.5');

    // /doctor
    assert.equal(await repl.handleSlashCommand('/doctor'), true);

    // /init (creates SAMSUDIN.md)
    assert.equal(await repl.handleSlashCommand('/init'), true);
    assert.ok(fs.existsSync(path.join(tmpDir, 'SAMSUDIN.md')));
    // calling /init again when already exists
    assert.equal(await repl.handleSlashCommand('/init'), true);

    // /tools
    assert.equal(await repl.handleSlashCommand('/tools'), true);

    // /stats
    assert.equal(await repl.handleSlashCommand('/stats'), true);

    // /compact & /clear
    assert.equal(await repl.handleSlashCommand('/compact'), true);
    assert.equal(await repl.handleSlashCommand('/clear'), true);

    // /yolo toggle
    assert.equal(repl.yolo, false);
    assert.equal(await repl.handleSlashCommand('/yolo'), true);
    assert.equal(repl.yolo, true);

    // /exit
    assert.equal(await repl.handleSlashCommand('/exit'), 'EXIT');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Git Tools - inspects repo status and diff', async () => {
  const status = await getGitStatus({ cwd: process.cwd() });
  assert.equal(status.isGitRepo, true);
  assert.ok(typeof status.branch === 'string');

  const diff = await getGitDiff({ cwd: process.cwd() });
  assert.equal(diff.success, true);
  assert.ok(typeof diff.diff === 'string');
});
