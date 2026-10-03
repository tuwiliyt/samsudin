import readline from 'node:readline';
import path from 'node:path';
import { resolveWorkspacePath } from '../utils/path-resolver.mjs';

/**
 * Approval modes (inspired by Codex CLI presets):
 *   suggest    - ask before every write / command (read-only actions are auto-approved)
 *   auto-edit  - auto-approve file edits inside the workspace; ask for other commands
 *   full-auto  - never ask (still blocks known-destructive patterns)
 * Plan mode (inspired by Cline) is an independent read-only overlay: only inspection is allowed.
 */
export const APPROVAL_MODES = ['suggest', 'auto-edit', 'full-auto'];

const READ_ONLY_TOOLS = new Set(['view_file', 'grep', 'glob', 'git_status', 'git_diff']);
const FILE_WRITE_TOOLS = new Set(['write_file', 'replace_file_content']);

const SIMPLE_READONLY_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'pwd', 'which', 'whoami', 'date',
  'uname', 'df', 'du', 'free', 'ps', 'pgrep', 'ss', 'netstat', 'lsof', 'wc', 'uniq', 'stat', 'file',
  'echo', 'printenv', 'id', 'uptime', 'nproc', 'tree', 'hostname', 'lsb_release', 'sleep', 'true', 'test', 'basename', 'dirname', 'realpath'
]);

const SUBCOMMAND_READONLY = {
  git: new Set(['status', 'diff', 'log', 'show', 'branch', 'remote', 'rev-parse', 'ls-files', 'blame', 'describe']),
  docker: new Set(['ps', 'images', 'logs', 'inspect', 'info', 'version', 'stats', 'top', 'port']),
  kubectl: new Set(['get', 'describe', 'logs', 'cluster-info', 'version', 'top', 'api-resources']),
  systemctl: new Set(['status', 'is-active', 'is-enabled', 'list-units']),
  journalctl: null, // read-only by nature
  ip: new Set(['addr', 'a', 'route', 'link'])
};

/**
 * Conservative check that a shell command cannot modify state.
 * Anything it cannot prove read-only is treated as NOT read-only.
 */
export function isReadOnlyBash(command) {
  if (!command || typeof command !== 'string') return false;

  // Allow only benign redirections (stderr merge / discard to /dev/null)
  const stripped = command.replace(/\d?>&\d|\d?>\s*\/dev\/null/g, '');
  if (/[<>]/.test(stripped)) return false;
  if (/`|\$\(|\$\{/.test(stripped)) return false;

  const segments = stripped.split(/&&|\|\||;|\||\n/).map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return false;

  for (const seg of segments) {
    if (/&/.test(seg)) return false; // background / stray ampersand
    const tokens = seg.split(/\s+/);
    const bin = tokens[0];

    if (SIMPLE_READONLY_COMMANDS.has(bin)) continue;

    if (bin === 'find') {
      if (/-(delete|exec|execdir|ok|okdir|fprint|fprintf|fls)\b/.test(seg)) return false;
      continue;
    }
    if (bin === 'sort') {
      if (/(^|\s)(-o|--output)\b/.test(seg)) return false;
      continue;
    }
    if (bin === 'journalctl') continue;

    if (Object.prototype.hasOwnProperty.call(SUBCOMMAND_READONLY, bin)) {
      const allowed = SUBCOMMAND_READONLY[bin];
      const sub = tokens.slice(1).find(t => !t.startsWith('-'));
      if (!sub || !allowed.has(sub)) return false;
      // `git branch <name>` / `git remote add` style mutations
      if (bin === 'git' && sub === 'branch' && tokens.slice(2).some(t => !t.startsWith('-') )) return false;
      if (bin === 'git' && sub === 'remote' && tokens.slice(2).some(t => ['add', 'remove', 'rm', 'rename', 'set-url'].includes(t))) return false;
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Permission and Governance Gate for Samsudin Agent
 */
export class PermissionGate {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.planMode = Boolean(options.planMode);

    let mode = options.mode;
    if (!APPROVAL_MODES.includes(mode)) mode = undefined;
    const yolo = Boolean(options.yolo || process.env.SAMSUDIN_YOLO === '1');
    this.mode = mode || (yolo ? 'full-auto' : 'suggest');

    this.dangerousBashPatterns = [
      /rm\s+-rf\s+\/(\s|$)/,
      /rm\s+-rf\s+(~|\$HOME|\/\*)(\s|$)/,
      />\s*\/dev\/sd[a-z]/,
      /dd\s+.*of=\/dev\/(sd|nvme|vd)/,
      /mkfs\./,
      /chmod\s+-R\s+777\s+\/(\s|$)/,
      /:\(\)\{ :\|:& \};:/,
      /:\(\)\s*\{\s*:\|:&\s*\};:/
    ];
  }

  /** Back-compat: `yolo` is shorthand for full-auto mode. */
  get yolo() {
    return this.mode === 'full-auto';
  }

  set yolo(value) {
    this.mode = value ? 'full-auto' : 'suggest';
  }

  setMode(mode) {
    if (!APPROVAL_MODES.includes(mode)) {
      throw new Error(`Invalid approval mode '${mode}'. Valid: ${APPROVAL_MODES.join(', ')}`);
    }
    this.mode = mode;
  }

  isSafe(toolName, args = {}) {
    if (READ_ONLY_TOOLS.has(toolName)) return true;
    if (toolName === 'process_manager' && args.action !== 'kill') return true;
    if (toolName === 'bash' && !args.isBackground && !args.background && isReadOnlyBash(args.command)) return true;
    return false;
  }

  isDangerous(toolName, args = {}) {
    if (toolName === 'bash' && args.command) {
      for (const pattern of this.dangerousBashPatterns) {
        if (pattern.test(args.command)) {
          return true;
        }
      }
    }
    return false;
  }

  isInsideWorkspace(filePath) {
    try {
      const resolved = resolveWorkspacePath(filePath, this.cwd);
      const root = path.resolve(this.cwd);
      return resolved === root || resolved.startsWith(root + path.sep);
    } catch {
      return false;
    }
  }

  async checkPermission(toolName, args = {}) {
    if (this.isDangerous(toolName, args)) {
      return {
        allowed: false,
        reason: `Blocked potentially destructive command pattern: ${args.command}`
      };
    }

    // Plan mode: strictly read-only, regardless of approval mode (never prompts).
    if (this.planMode) {
      if (this.isSafe(toolName, args)) return { allowed: true };
      return {
        allowed: false,
        reason: `PLAN MODE is read-only: '${toolName}' would modify state. Use only inspection tools and finish with a written plan; the user will approve execution separately.`
      };
    }

    if (this.mode === 'full-auto' || this.isSafe(toolName, args)) {
      return { allowed: true };
    }

    if (this.mode === 'auto-edit' && FILE_WRITE_TOOLS.has(toolName) && this.isInsideWorkspace(args.filePath)) {
      return { allowed: true };
    }

    // In non-interactive or testing environments without stdin TTY, auto-permit if not destructive
    if (!process.stdin.isTTY) {
      return { allowed: true };
    }

    // Prompt user in interactive terminal
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const promptMsg = `\n[Samsudin Permission | mode: ${this.mode}] Tool: \x1b[33m${toolName}\x1b[0m\nArgs: ${JSON.stringify(args, null, 2)}\nAllow execution? (y/N): `;
      rl.question(promptMsg, (answer) => {
        rl.close();
        const allowed = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
        resolve({
          allowed,
          reason: allowed ? undefined : 'Execution rejected by user.'
        });
      });
    });
  }
}
