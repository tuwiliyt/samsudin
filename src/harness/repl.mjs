import readline from 'node:readline';
import path from 'node:path';
import { AgentLoop } from './agent-loop.mjs';
import { ContextCompactor } from './context-compactor.mjs';
import { PermissionGate } from './permissions.mjs';
import { SessionManager } from './session-manager.mjs';
import { ConfigManager } from '../config/config-manager.mjs';
import { OpenAIProvider } from '../providers/openai-provider.mjs';
import { TOOL_DEFINITIONS, dispatchToolCall } from '../tools/registry.mjs';
import { colors, createEventHandler } from '../utils/terminal-ui.mjs';

/**
 * Interactive Multi-Turn REPL for Samsudin Agent Harness.
 * Mirrors the workflow of OpenCode, Hermes, and Claude Code.
 */
export class SamsudinREPL {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.configManager = new ConfigManager(this.cwd);
    this.config = this.configManager.loadConfig();

    this.model = options.model || this.config.defaultModel || 'ERINE-5.1';
    this.apiUrl = options.apiUrl || this.config.apiUrl || 'http://127.0.0.1:4318/v1';
    this.apiKey = options.apiKey || this.config.apiKey || 'dummy-key';
    this.yolo = options.yolo ?? this.config.yolo ?? false;
    this.verbose = Boolean(options.verbose);
    this.maxSteps = options.maxSteps || this.config.maxSteps || 25;

    this.sessionManager = new SessionManager(this.cwd);
    this.compactor = new ContextCompactor();
    this.permissionGate = new PermissionGate({ yolo: this.yolo });

    this.conversationHistory = [];
    this.provider = this.createProvider(this.model);
    this.isRunning = false;
  }

  createProvider(modelName) {
    return new OpenAIProvider({
      baseUrl: this.apiUrl,
      apiKey: this.apiKey,
      model: modelName
    });
  }

  async start() {
    this.isRunning = true;
    console.log(`\n${colors.cyan}${colors.bright}Samsudin Interactive REPL Session Started${colors.reset}`);
    console.log(`${colors.dim}Active Model:${colors.reset} \x1b[32m${this.model}\x1b[0m | ${colors.dim}YOLO Mode:${colors.reset} ${this.yolo ? '\x1b[33mON\x1b[0m' : 'OFF'}`);
    console.log(`${colors.dim}Type ${colors.cyan}/help${colors.dim} for slash commands or ${colors.cyan}/exit${colors.dim} to quit.${colors.reset}\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.cyan}${colors.bright}samsudin (${this.model})${colors.reset} > `
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      // Handle Slash Commands
      if (input.startsWith('/')) {
        const handled = await this.handleSlashCommand(input);
        if (handled === 'EXIT') {
          rl.close();
          return;
        }
        rl.setPrompt(`${colors.cyan}${colors.bright}samsudin (${this.model})${colors.reset} > `);
        rl.prompt();
        return;
      }

      // Execute Task in Agent Loop
      rl.pause();
      try {
        await this.executeTurn(input);
      } catch (err) {
        console.error(`\n${colors.red}${colors.bright}Error:${colors.reset} ${err.message}\n`);
      } finally {
        rl.setPrompt(`${colors.cyan}${colors.bright}samsudin (${this.model})${colors.reset} > `);
        rl.resume();
        rl.prompt();
      }
    });

    rl.on('close', () => {
      console.log(`\n${colors.dim}Session saved to ${this.sessionManager.sessionFile}${colors.reset}`);
      console.log(`${colors.green}Goodbye!${colors.reset}`);
      process.exit(0);
    });
  }

  async executeTurn(userGoal) {
    this.sessionManager.stats.modelUsed = this.model;

    const loop = new AgentLoop({
      provider: this.provider,
      cwd: this.cwd,
      yolo: this.yolo,
      maxSteps: this.maxSteps,
      compactor: this.compactor,
      permissionGate: this.permissionGate,
      onEvent: createEventHandler({ verbose: this.verbose })
    });

    const result = await loop.runTask(userGoal);
    this.conversationHistory = result.messages || [];

    // Extract tool calls made in this turn
    const toolCallsThisTurn = [];
    for (const msg of this.conversationHistory) {
      if (msg.role === 'user' && msg.content?.includes?.('=== TOOL RESULT:')) {
        const match = msg.content.match(/=== TOOL RESULT: ([a-zA-Z0-9_\-]+) ===/);
        if (match) toolCallsThisTurn.push({ name: match[1] });
      }
    }

    this.sessionManager.recordTurn(userGoal, result.finalAnswer, toolCallsThisTurn);
  }

  async handleSlashCommand(input) {
    const [cmd, ...args] = input.split(' ');
    const lowerCmd = cmd.toLowerCase();

    switch (lowerCmd) {
      case '/exit':
      case '/quit':
        return 'EXIT';

      case '/help':
        console.log(`
${colors.bright}Available Commands:${colors.reset}
  ${colors.cyan}/model <name>${colors.reset}    Switch active model (e.g. /model k1.5, /model intern-s1)
  ${colors.cyan}/models${colors.reset}          List all models available from backend
  ${colors.cyan}/clear${colors.reset}           Clear conversation history (start fresh)
  ${colors.cyan}/compact${colors.reset}         Force context compaction now
  ${colors.cyan}/tools${colors.reset}           List all registered tools
  ${colors.cyan}/yolo${colors.reset}            Toggle auto-approve mode on/off
  ${colors.cyan}/stats${colors.reset}           View current session statistics
  ${colors.cyan}/git${colors.reset}             Inspect current git status and branch
  ${colors.cyan}/diff${colors.reset}            Show uncommitted git diff
  ${colors.cyan}/exit${colors.reset}            Exit Samsudin REPL
`);
        return true;

      case '/model': {
        const newModel = args[0]?.trim();
        if (!newModel) {
          console.log(`Current model: ${colors.green}${this.model}${colors.reset}. Usage: /model <model-name>`);
          return true;
        }
        this.model = newModel;
        this.provider = this.createProvider(newModel);
        this.configManager.saveLocalConfig({ defaultModel: newModel });
        console.log(`${colors.green}✔ Switched active model to:${colors.reset} ${colors.bright}${newModel}${colors.reset}`);
        return true;
      }

      case '/models': {
        try {
          const res = await fetch(`${this.apiUrl}/models`);
          if (res.ok) {
            const data = await res.json();
            console.log(`\n${colors.bright}Available Models from ${this.apiUrl}:${colors.reset}`);
            data.data?.forEach(m => console.log(`  • ${m.id} (${m.owned_by || 'ai-free'})`));
            console.log('');
          } else {
            console.log(`Failed to fetch models: HTTP ${res.status}`);
          }
        } catch (e) {
          console.log(`Error connecting to ${this.apiUrl}: ${e.message}`);
        }
        return true;
      }

      case '/clear':
        this.conversationHistory = [];
        console.log(`${colors.green}✔ Conversation context reset.${colors.reset}\n`);
        return true;

      case '/compact': {
        const before = this.conversationHistory.length;
        this.conversationHistory = this.compactor.compactMessages(this.conversationHistory);
        console.log(`${colors.green}✔ Context compacted (${before} messages processed).${colors.reset}\n`);
        return true;
      }

      case '/tools':
        console.log(`\n${colors.bright}Registered Tools (${TOOL_DEFINITIONS.length}):${colors.reset}`);
        TOOL_DEFINITIONS.forEach(t => {
          console.log(`  ${colors.yellow}${t.name.padEnd(22)}${colors.reset} ${t.description}`);
        });
        console.log('');
        return true;

      case '/yolo':
        this.yolo = !this.yolo;
        this.permissionGate.yolo = this.yolo;
        console.log(`YOLO Auto-Approve: ${this.yolo ? '\x1b[33mON\x1b[0m' : 'OFF'}\n`);
        return true;

      case '/stats': {
        const s = this.sessionManager.getStatsSummary();
        console.log(`
${colors.bright}Session Statistics:${colors.reset}
  Session ID:      ${s.sessionId}
  Active Model:    ${this.model}
  Total Turns:     ${s.turns}
  Total Tool Calls:${s.toolCallsCount}
  Tools Breakdown: ${JSON.stringify(s.toolsUsed, null, 2)}
  Log File:        ${s.sessionFile}
`);
        return true;
      }

      case '/git': {
        const { getGitStatus } = await import('../tools/git-tools.mjs');
        const st = await getGitStatus({ cwd: this.cwd });
        console.log(`\n${colors.bright}Git Branch:${colors.reset} ${st.branch}`);
        console.log(`${st.output}\n`);
        return true;
      }

      case '/diff': {
        const { getGitDiff } = await import('../tools/git-tools.mjs');
        const diff = await getGitDiff({ cwd: this.cwd });
        console.log(`\n${colors.bright}Git Diff:${colors.reset}\n${diff.diff || '(no diff)'}\n`);
        return true;
      }

      default:
        console.log(`Unknown command: ${cmd}. Type ${colors.cyan}/help${colors.reset} for commands.`);
        return true;
    }
  }
}
