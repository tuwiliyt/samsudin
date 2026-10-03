import readline from 'node:readline';

/**
 * Permission and Governance Gate for Samsudin Agent
 */
export class PermissionGate {
  constructor(options = {}) {
    this.yolo = Boolean(options.yolo || process.env.SAMSUDIN_YOLO === '1');
    this.safeTools = new Set(['view_file', 'grep', 'glob']);
    this.dangerousBashPatterns = [
      /rm\s+-rf\s+\/(\s|$)/,
      />\s*\/dev\/sd[a-z]/,
      /mkfs\./,
      /:(){ :\|:& };:/
    ];
  }

  isSafe(toolName, args = {}) {
    if (this.safeTools.has(toolName)) {
      return true;
    }
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

  async checkPermission(toolName, args = {}) {
    if (this.isDangerous(toolName, args)) {
      return {
        allowed: false,
        reason: `Blocked potentially destructive command pattern: ${args.command}`
      };
    }

    if (this.yolo || this.isSafe(toolName, args)) {
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

      const promptMsg = `\n[Samsudin Permission] Tool: \x1b[33m${toolName}\x1b[0m\nArgs: ${JSON.stringify(args, null, 2)}\nAllow execution? (y/N): `;
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
