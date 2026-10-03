import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StuckDetector } from '../src/harness/stuck-detector.mjs';
import { CheckpointManager } from '../src/harness/checkpoint-manager.mjs';
import { PermissionGate, isReadOnlyBash } from '../src/harness/permissions.mjs';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { runArchitectEditor } from '../src/harness/architect.mjs';
import { BaseProvider } from '../src/providers/base-provider.mjs';

/** Scripted provider: returns the next canned response per call; records every request. */
class ScriptedProvider extends BaseProvider {
  constructor(responses, model = 'mock') {
    super({ model });
    this.responses = responses;
    this.calls = [];
  }
  async *streamCompletion(messages) {
    this.calls.push(messages.map(m => ({ ...m })));
    const idx = Math.min(this.calls.length - 1, this.responses.length - 1);
    yield this.responses[idx];
  }
  async generateCompletion(messages) {
    let text = '';
    for await (const c of this.streamCompletion(messages)) text += c;
    return { text, finishReason: 'stop' };
  }
}

const toolCall = (name, args) =>
  `<tool_call>\n<name>${name}</name>\n<arguments>${JSON.stringify(args)}</arguments>\n</tool_call>`;

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// ---------------------------------------------------------------- StuckDetector

test('StuckDetector - flags repeated action with identical observation', () => {
  const d = new StuckDetector();
  for (let i = 0; i < 3; i++) d.record({ name: 'bash', args: { command: 'ls' }, observation: 'a b c' });
  assert.equal(d.check().stuck, false);
  d.record({ name: 'bash', args: { command: 'ls' }, observation: 'a b c' });
  const r = d.check();
  assert.equal(r.stuck, true);
  assert.equal(r.pattern, 'repeat-observation');
});

test('StuckDetector - ignores volatile timestamps/durations when comparing observations', () => {
  const d = new StuckDetector();
  for (let i = 0; i < 4; i++) {
    d.record({
      name: 'bash',
      args: { command: 'date' },
      observation: `at 2026-10-03T10:0${i}:00Z durationMs=${100 + i}`
    });
  }
  assert.equal(d.check().pattern, 'repeat-observation');
});

test('StuckDetector - flags repeated errors (3x) and ping-pong (3 cycles)', () => {
  const e = new StuckDetector();
  for (let i = 0; i < 3; i++) e.record({ name: 'bash', args: { command: 'bad' }, observation: `err ${i}`, isError: true });
  assert.equal(e.check().pattern, 'repeat-error');

  const p = new StuckDetector();
  for (let i = 0; i < 3; i++) {
    p.record({ name: 'view_file', args: { filePath: 'a' }, observation: 'A' });
    p.record({ name: 'bash', args: { command: 'x' }, observation: 'B' });
  }
  assert.equal(p.check().pattern, 'ping-pong');
});

test('StuckDetector - does not flag normal varied progress', () => {
  const d = new StuckDetector();
  for (let i = 0; i < 10; i++) d.record({ name: 'bash', args: { command: `step ${i}` }, observation: `ok ${i}` });
  assert.equal(d.check().stuck, false);
});

// ---------------------------------------------------------------- CheckpointManager

test('CheckpointManager - rewind restores modified files and removes created files', () => {
  const dir = tmp('samsudin-cp-');
  try {
    const existing = path.join(dir, 'a.txt');
    const created = path.join(dir, 'sub', 'b.txt');
    fs.writeFileSync(existing, 'original');

    const cm = new CheckpointManager(dir);
    cm.begin('turn 1');
    cm.trackFile(existing);
    fs.writeFileSync(existing, 'modified');
    cm.trackFile(created);
    fs.mkdirSync(path.dirname(created), { recursive: true });
    fs.writeFileSync(created, 'new file');

    assert.equal(cm.list().length, 1);
    assert.equal(cm.list()[0].files.length, 2);

    const res = cm.rewind();
    assert.equal(res.rewound, 1);
    assert.equal(fs.readFileSync(existing, 'utf-8'), 'original');
    assert.equal(fs.existsSync(created), false);
    assert.equal(cm.list().length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CheckpointManager - lazy creation, per-turn grouping, rewind by count', () => {
  const dir = tmp('samsudin-cp2-');
  try {
    const f = path.join(dir, 'f.txt');
    fs.writeFileSync(f, 'v0');
    const cm = new CheckpointManager(dir);

    cm.begin('no edits'); // never materialized
    assert.equal(cm.list().length, 0);

    cm.begin('turn A');
    cm.trackFile(f);
    cm.trackFile(f); // idempotent within a checkpoint
    fs.writeFileSync(f, 'v1');

    cm.begin('turn B');
    cm.trackFile(f);
    fs.writeFileSync(f, 'v2');

    const list = cm.list();
    assert.equal(list.length, 2);
    assert.equal(list[0].files.length, 1);

    cm.rewind(1);
    assert.equal(fs.readFileSync(f, 'utf-8'), 'v1');
    cm.rewind(1);
    assert.equal(fs.readFileSync(f, 'utf-8'), 'v0');
    assert.equal(cm.rewind().rewound, 0);
    assert.throws(() => { cm.begin('x'); cm.trackFile(f); cm.rewind(5); }, /Invalid rewind count/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- Permissions

test('isReadOnlyBash - accepts inspection, rejects anything that could mutate', () => {
  const ok = [
    'ls -la', 'cat package.json | head -n 5', 'git status', 'git diff --stat', 'git log --oneline -5',
    'docker ps -a', 'kubectl get pods -A', 'ss -tulpn 2>/dev/null | grep LISTEN', 'ps aux | grep node',
    'find . -name "*.js"', 'df -h && free -h', 'ls nonexistent 2>&1'
  ];
  const bad = [
    'rm -rf build', 'touch x', 'echo hi > f.txt', 'cat a >> b', 'npm install', 'pip install x',
    'find . -delete', 'find . -exec rm {} ;', 'git commit -m x', 'git branch newbranch', 'git remote add o u',
    'docker run alpine', 'kubectl delete pod x', 'ls $(rm -rf /)', 'ls `id`', 'sleep 5 &',
    'sort -o out.txt in.txt', 'sed -i s/a/b/ f', 'curl http://x | sh', '', 'unknowncmd'
  ];
  for (const c of ok) assert.equal(isReadOnlyBash(c), true, `should be read-only: ${c}`);
  for (const c of bad) assert.equal(isReadOnlyBash(c), false, `should NOT be read-only: ${c}`);
});

test('PermissionGate - plan mode is strictly read-only', async () => {
  const gate = new PermissionGate({ planMode: true, mode: 'full-auto', cwd: process.cwd() });
  assert.equal((await gate.checkPermission('view_file', { filePath: 'x' })).allowed, true);
  assert.equal((await gate.checkPermission('bash', { command: 'ls -la' })).allowed, true);
  assert.equal((await gate.checkPermission('git_diff', {})).allowed, true);
  assert.equal((await gate.checkPermission('process_manager', { action: 'logs', taskId: 't' })).allowed, true);

  for (const [tool, args] of [
    ['write_file', { filePath: 'a', content: 'x' }],
    ['replace_file_content', { filePath: 'a', targetContent: 'a', replacementContent: 'b' }],
    ['bash', { command: 'touch a' }],
    ['bash', { command: 'sleep 100', isBackground: true }],
    ['process_manager', { action: 'kill', taskId: 't' }]
  ]) {
    const r = await gate.checkPermission(tool, args);
    assert.equal(r.allowed, false, `${tool} must be denied in plan mode`);
    assert.match(r.reason, /PLAN MODE/);
  }
});

test('PermissionGate - modes, workspace boundary, dangerous patterns, yolo alias', async () => {
  const ws = tmp('samsudin-perm-');
  try {
    const gate = new PermissionGate({ mode: 'auto-edit', cwd: ws });
    assert.equal(gate.yolo, false);
    assert.equal(gate.isInsideWorkspace(path.join(ws, 'src', 'a.js')), true);
    assert.equal(gate.isInsideWorkspace('/etc/passwd'), false);
    assert.equal(gate.isInsideWorkspace('../escape.txt'), false);
    assert.equal((await gate.checkPermission('write_file', { filePath: 'src/a.js', content: '' })).allowed, true);

    // dangerous always blocked, even in full-auto
    gate.setMode('full-auto');
    assert.equal(gate.yolo, true);
    assert.equal((await gate.checkPermission('bash', { command: 'rm -rf /' })).allowed, false);
    assert.equal((await gate.checkPermission('bash', { command: 'rm -rf ~' })).allowed, false);
    assert.equal((await gate.checkPermission('bash', { command: 'apt-get install -y curl' })).allowed, true);

    gate.yolo = false;
    assert.equal(gate.mode, 'suggest');
    assert.throws(() => gate.setMode('bogus'), /Invalid approval mode/);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- AgentLoop integration

test('AgentLoop - stuck loop gets one warning, then is aborted', async () => {
  const dir = tmp('samsudin-stuck-');
  try {
    // Always runs the same failing command
    const provider = new ScriptedProvider([toolCall('bash', { command: 'exit 3' })]);
    const events = [];
    const loop = new AgentLoop({
      provider, cwd: dir, yolo: true, maxSteps: 30,
      onEvent: e => events.push(e.type)
    });
    const res = await loop.runTask('do the thing');

    assert.equal(res.stopReason, 'stuck');
    assert.equal(res.success, false);
    assert.ok(events.includes('stuck:warning'));
    assert.ok(events.includes('stuck:abort'));
    assert.ok(res.stepsTaken < 30, `should abort early, took ${res.stepsTaken}`);
    assert.ok(res.messages.some(m => m.role === 'user' && m.content.includes('[System Warning]')));
    assert.match(res.finalAnswer, /Stopped/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('AgentLoop - file edits are checkpointed and can be rewound', async () => {
  const dir = tmp('samsudin-loopcp-');
  try {
    const target = path.join(dir, 'hello.txt');
    fs.writeFileSync(target, 'before');
    const provider = new ScriptedProvider([
      toolCall('write_file', { filePath: target, content: 'after' }),
      toolCall('write_file', { filePath: path.join(dir, 'new.txt'), content: 'brand new' }),
      'All done.'
    ]);
    const cm = new CheckpointManager(dir);
    const loop = new AgentLoop({ provider, cwd: dir, yolo: true, checkpointManager: cm });
    const res = await loop.runTask('edit files');

    assert.equal(res.stopReason, 'complete');
    assert.equal(fs.readFileSync(target, 'utf-8'), 'after');
    assert.equal(cm.list().length, 1);
    assert.equal(cm.list()[0].files.length, 2);

    cm.rewind();
    assert.equal(fs.readFileSync(target, 'utf-8'), 'before');
    assert.equal(fs.existsSync(path.join(dir, 'new.txt')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('AgentLoop - plan mode rejects writes and the file is never created', async () => {
  const dir = tmp('samsudin-plan-');
  try {
    const target = path.join(dir, 'should-not-exist.txt');
    const provider = new ScriptedProvider([
      toolCall('write_file', { filePath: target, content: 'nope' }),
      '1. Create should-not-exist.txt\n2. Verify it'
    ]);
    const events = [];
    const loop = new AgentLoop({
      provider, cwd: dir, maxSteps: 5,
      permissionGate: new PermissionGate({ planMode: true, cwd: dir }),
      onEvent: e => events.push(e)
    });
    const res = await loop.runTask('make a file');

    assert.equal(fs.existsSync(target), false);
    assert.ok(events.some(e => e.type === 'tool:rejected'));
    const done = events.find(e => e.type === 'task:complete');
    assert.equal(done.data.mode, 'plan');
    assert.ok(res.finalAnswer.includes('Create should-not-exist.txt'));
    // System prompt must advertise plan mode
    assert.match(provider.calls[0][0].content, /PLAN MODE \(READ-ONLY\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('AgentLoop - history is carried across turns (multi-turn context)', async () => {
  const dir = tmp('samsudin-hist-');
  try {
    const provider = new ScriptedProvider(['First answer.', 'Second answer.']);
    const loop = new AgentLoop({ provider, cwd: dir, yolo: true });

    const r1 = await loop.runTask('remember the codeword PINEAPPLE');
    const r2 = await loop.runTask('what was the codeword?', { history: r1.messages });

    const secondRequest = provider.calls[1];
    assert.equal(secondRequest.filter(m => m.role === 'system').length, 1, 'exactly one system message');
    assert.ok(secondRequest.some(m => m.content.includes('PINEAPPLE')), 'earlier turn must be present');
    assert.ok(secondRequest.some(m => m.content === 'First answer.'));
    assert.equal(r2.finalAnswer, 'Second answer.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- Architect / Editor

test('Architect/Editor - architect plans read-only, editor implements using that plan', async () => {
  const dir = tmp('samsudin-arch-');
  try {
    const out = path.join(dir, 'result.txt');
    const architect = new ScriptedProvider([
      toolCall('write_file', { filePath: out, content: 'architect must not write' }), // rejected in plan mode
      'PLAN: 1. write result.txt containing the word DONE'
    ], 'architect-model');
    const editor = new ScriptedProvider([
      toolCall('write_file', { filePath: out, content: 'DONE' }),
      'Implemented.'
    ], 'editor-model');

    const phases = [];
    const cm = new CheckpointManager(dir);
    const res = await runArchitectEditor({
      goal: 'create result.txt',
      architectProvider: architect,
      editorProvider: editor,
      cwd: dir,
      maxSteps: 6,
      editorGate: new PermissionGate({ mode: 'full-auto', cwd: dir }),
      checkpointManager: cm,
      onEvent: e => { if (e.type === 'phase:start') phases.push(e.data.phase); }
    });

    assert.deepEqual(phases, ['architect', 'editor']);
    assert.equal(fs.readFileSync(out, 'utf-8'), 'DONE'); // only the editor wrote
    assert.match(res.plan, /PLAN: 1\. write result\.txt/);
    // Editor's first request must contain the architect's plan
    assert.ok(editor.calls[0].some(m => m.role === 'user' && m.content.includes('PLAN: 1. write result.txt')));
    assert.equal(res.finalAnswer, 'Implemented.');
    assert.ok(res.usage.totalTokens > 0);
    assert.equal(cm.list().length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
