import fs from 'node:fs';
import path from 'node:path';

/**
 * Checkpoint Manager (inspired by Cline / Claude Code checkpoints).
 *
 * Before the agent modifies a file via write_file / replace_file_content, the file's previous
 * state (content, or "did not exist") is snapshotted into `.samsudin/checkpoints/<id>/`.
 * One checkpoint == one user turn. `rewind()` restores files and removes files the agent created.
 *
 * Scope note: only edits made through Samsudin's file tools are tracked. Side effects of
 * arbitrary `bash` commands (installs, `sed -i`, `rm`, ...) are NOT captured.
 */
export class CheckpointManager {
  constructor(cwd = process.cwd(), { maxCheckpoints = 20 } = {}) {
    this.cwd = cwd;
    this.root = path.resolve(cwd, '.samsudin', 'checkpoints');
    this.maxCheckpoints = maxCheckpoints;
    this.pendingLabel = null;
    this.current = null; // materialized checkpoint manifest for the active turn
  }

  /** Start a new (lazy) checkpoint for a turn. Nothing is written until a file is tracked. */
  begin(label = 'turn') {
    this.pendingLabel = String(label).slice(0, 120);
    this.current = null;
  }

  _manifestPath(id) {
    return path.join(this.root, id, 'manifest.json');
  }

  _readManifest(id) {
    try {
      return JSON.parse(fs.readFileSync(this._manifestPath(id), 'utf-8'));
    } catch {
      return null;
    }
  }

  _writeManifest(manifest) {
    fs.writeFileSync(this._manifestPath(manifest.id), JSON.stringify(manifest, null, 2), 'utf-8');
  }

  list() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root)
      .filter(name => name.startsWith('cp-'))
      .map(id => this._readManifest(id))
      .filter(Boolean)
      .sort((a, b) => a.seq - b.seq);
  }

  _materialize() {
    if (this.current) return this.current;
    fs.mkdirSync(this.root, { recursive: true });
    const existing = this.list();
    const seq = existing.length ? existing[existing.length - 1].seq + 1 : 1;
    const id = `cp-${String(seq).padStart(4, '0')}`;
    fs.mkdirSync(path.join(this.root, id, 'files'), { recursive: true });
    this.current = {
      id,
      seq,
      label: this.pendingLabel || 'turn',
      createdAt: new Date().toISOString(),
      files: []
    };
    this._writeManifest(this.current);
    this._prune();
    return this.current;
  }

  _prune() {
    const all = this.list();
    const excess = all.length - this.maxCheckpoints;
    for (let i = 0; i < excess; i++) {
      fs.rmSync(path.join(this.root, all[i].id), { recursive: true, force: true });
    }
  }

  /** Snapshot a file's prior state (idempotent per checkpoint). Call BEFORE modifying it. */
  trackFile(absPath) {
    const cp = this._materialize();
    const target = path.resolve(absPath);
    if (cp.files.some(f => f.path === target)) return false;

    let existed = false;
    let backup = null;
    try {
      existed = fs.existsSync(target) && fs.statSync(target).isFile();
    } catch {}

    if (existed) {
      backup = `files/${cp.files.length}.bak`;
      fs.copyFileSync(target, path.join(this.root, cp.id, backup));
    }
    cp.files.push({ path: target, existed, backup });
    this._writeManifest(cp);
    return true;
  }

  /**
   * Rewind to before checkpoint `target` (id like "cp-0003", or 1-based offset from newest; default 1).
   * Restores every file from that checkpoint and all newer ones, then deletes those checkpoints.
   */
  rewind(target = 1) {
    const all = this.list();
    if (all.length === 0) {
      return { rewound: 0, restored: [], removed: [], message: 'No checkpoints to rewind.' };
    }

    let startIdx;
    if (typeof target === 'string' && target.startsWith('cp-')) {
      startIdx = all.findIndex(c => c.id === target);
      if (startIdx === -1) throw new Error(`Checkpoint not found: ${target}`);
    } else {
      const n = parseInt(target, 10) || 1;
      if (n < 1 || n > all.length) throw new Error(`Invalid rewind count ${n} (available: ${all.length}).`);
      startIdx = all.length - n;
    }

    const toUndo = all.slice(startIdx).reverse(); // newest first
    const restored = [];
    const removed = [];

    for (const cp of toUndo) {
      // Undo files in reverse order of tracking
      for (const f of [...cp.files].reverse()) {
        if (f.existed && f.backup) {
          fs.mkdirSync(path.dirname(f.path), { recursive: true });
          fs.copyFileSync(path.join(this.root, cp.id, f.backup), f.path);
          restored.push(f.path);
        } else if (!f.existed && fs.existsSync(f.path)) {
          fs.rmSync(f.path, { force: true });
          removed.push(f.path);
        }
      }
      fs.rmSync(path.join(this.root, cp.id), { recursive: true, force: true });
    }

    this.current = null;
    return {
      rewound: toUndo.length,
      restored,
      removed,
      message: `Rewound ${toUndo.length} checkpoint(s): ${restored.length} file(s) restored, ${removed.length} created file(s) removed.`
    };
  }
}
