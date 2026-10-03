import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { AgentLoop } from './agent-loop.mjs';
import { ContextCompactor } from './context-compactor.mjs';
import { PermissionGate } from './permissions.mjs';
import { SessionManager } from './session-manager.mjs';
import { ConfigManager } from '../config/config-manager.mjs';
import { OpenAIProvider, estimateTokens } from '../providers/openai-provider.mjs';
import { AuthManager } from '../auth/auth-manager.mjs';
import { TOOL_DEFINITIONS, dispatchToolCall } from '../tools/registry.mjs';
import { colors, createEventHandler } from '../utils/terminal-ui.mjs';

/**
 * Model Metadata & Context Limits
 */
export const MODEL_METADATA = {
  'intern-s1': { name: 'InternLM 2.5 (s1)', provider: 'InternLM / OpenXLab', contextWindow: 131072, desc: 'Optimized for reasoning and agentic tool-use' },
  'deepseek-chat': { name: 'DeepSeek-V3', provider: 'DeepSeek', contextWindow: 131072, desc: 'High capability general coding & architecture' },
  'deepseek-reasoner': { name: 'DeepSeek-R1', provider: 'DeepSeek', contextWindow: 131072, desc: 'Deep chain-of-thought mathematical reasoning' },
  'k1.5': { name: 'Kimi Moonshot k1.5', provider: 'Moonshot AI', contextWindow: 200000, desc: 'Long-context document & codebase understanding' },
  'minimax': { name: 'MiniMax-Text-01', provider: 'MiniMax Agent', contextWindow: 1000000, desc: 'Massive 1M token context window' },
  'mimo-flash': { name: 'Xiaomi MiMo Studio', provider: 'Xiaomi AI', contextWindow: 32768, desc: 'Fast fullstack & frontend generation' },
  'ERINE-5.1': { name: 'Baidu ERNIE 5.1', provider: 'Baidu Wenxin', contextWindow: 32768, desc: 'Multimodal knowledge & Chinese-English NLP' },
  'hy4-preview-g': { name: 'Tencent Hunyuan 4', provider: 'Tencent', contextWindow: 131072, desc: 'General coding and logical reasoning' },
  'hy3-g': { name: 'Tencent Hunyuan 3', provider: 'Tencent', contextWindow: 65536, desc: 'Balanced fast coding model' },
  'glm-4-plus': { name: 'Zhipu GLM-4 Plus', provider: 'Zhipu AI (Z.ai)', contextWindow: 131072, desc: 'Robust tool calling and instruction following' },
  'qwen-max': { name: 'Alibaba Qwen 3 Max', provider: 'Alibaba Cloud', contextWindow: 131072, desc: 'Multilingual and complex problem solving' },
  'chatgpt': { name: 'ChatGPT Web', provider: 'OpenAI', contextWindow: 131072, desc: 'Standard conversational coding' },
};

/**
 * Interactive Multi-Turn REPL for Samsudin Agent Harness.
 * Mirrors the workflow of OpenCode, Hermes, and Claude Code.
 */
export class SamsudinREPL {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.configManager = new ConfigManager(this.cwd);
    this.config = this.configManager.loadConfig();

    this.model = options.model || this.config.defaultModel || 'intern-s1';
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

    this.sessionManager.recordTurn(userGoal, result.finalAnswer, toolCallsThisTurn, result.usage);
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

  ${colors.dim}Model & AI Engine:${colors.reset}
    ${colors.cyan}/model [name]${colors.reset}     Show active model or switch to [name] (e.g. /model intern-s1)
    ${colors.cyan}/models${colors.reset}           List all models available from backend API
    ${colors.cyan}/usage, /cost${colors.reset}     Display token consumption, turn counts, and cost savings
    ${colors.cyan}/tokens${colors.reset}           Inspect active context window size, gauge, & capacity

  ${colors.dim}Session & Context:${colors.reset}
    ${colors.cyan}/clear${colors.reset}            Clear conversation context and start fresh
    ${colors.cyan}/compact${colors.reset}          Force 3-tier context compaction manually
    ${colors.cyan}/stats${colors.reset}            View comprehensive session metrics & tool analytics
    ${colors.cyan}/doctor${colors.reset}           Run system health check (Node, Git, API, Credentials)

  ${colors.dim}Developer & Git Tools:${colors.reset}
    ${colors.cyan}/init${colors.reset}             Initialize SAMSUDIN.md project rulebook in workspace
    ${colors.cyan}/review${colors.reset}           Perform autonomous AI code review on uncommitted diff
    ${colors.cyan}/undo${colors.reset}             Revert uncommitted modifications in tracked files
    ${colors.cyan}/git${colors.reset}              Inspect git branch, status, and modified files
    ${colors.cyan}/diff${colors.reset}             Show uncommitted git diff
    ${colors.cyan}/tools${colors.reset}            List all registered tools and parameter schemas
    ${colors.cyan}/yolo${colors.reset}             Toggle tool auto-approval mode on/off
    ${colors.cyan}/exit, /quit${colors.reset}      Save session and exit REPL
`);
        return true;

      case '/usage':
      case '/cost': {
        const s = this.sessionManager.getStatsSummary();
        const usage = s.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, savingsUsd: 0 };
        const meta = MODEL_METADATA[this.model] || { contextWindow: 131072 };

        console.log(`
${colors.cyan}┌─────────────────────────────────────────────────────────────┐${colors.reset}
${colors.cyan}│${colors.reset}                 ${colors.bright}Samsudin Token & Cost Usage${colors.reset}                 ${colors.cyan}│${colors.reset}
${colors.cyan}├───────────────────────────────┬─────────────────────────────┤${colors.reset}
  ${colors.dim}Session ID:${colors.reset}                   ${s.sessionId}
  ${colors.dim}Active Model:${colors.reset}                 ${this.model} (${meta.name || this.model})
  ${colors.dim}Total Turns Executed:${colors.reset}         ${s.turns}
  ${colors.dim}Total Tool Calls:${colors.reset}             ${s.toolCallsCount}
${colors.cyan}├───────────────────────────────┼─────────────────────────────┤${colors.reset}
  ${colors.dim}Input / Prompt Tokens:${colors.reset}        ${usage.promptTokens.toLocaleString()}
  ${colors.dim}Output / Completion Tokens:${colors.reset}   ${usage.completionTokens.toLocaleString()}
  ${colors.bright}Total Tokens Consumed:${colors.reset}         ${colors.green}${colors.bright}${usage.totalTokens.toLocaleString()}${colors.reset}
${colors.cyan}├───────────────────────────────┼─────────────────────────────┤${colors.reset}
  ${colors.dim}Samsudin Cost (AI-Free):${colors.reset}      ${colors.green}${colors.bright}$0.00 (100% Free)${colors.reset}
  ${colors.dim}Est. Commercial API Cost:${colors.reset}     ~$${usage.savingsUsd.toFixed(4)} USD
  ${colors.dim}Lifetime Net Savings:${colors.reset}         ${colors.green}~$${usage.savingsUsd.toFixed(4)} USD${colors.reset}
${colors.cyan}└───────────────────────────────┴─────────────────────────────┘${colors.reset}
`);
        return true;
      }

      case '/tokens': {
        const currentTokens = estimateTokens(this.conversationHistory);
        const meta = MODEL_METADATA[this.model] || { contextWindow: 131072 };
        const maxTokens = meta.contextWindow || 131072;
        const pct = Math.min(100, Number(((currentTokens / maxTokens) * 100).toFixed(1)));

        const barWidth = 30;
        const filled = Math.round((pct / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled));

        console.log(`
${colors.bright}Context Window Breakdown:${colors.reset}
  Model:             ${colors.cyan}${this.model}${colors.reset} (${meta.name || 'Unknown'})
  Context Capacity:  ${maxTokens.toLocaleString()} tokens
  Active Context:    ~${currentTokens.toLocaleString()} tokens (${pct}%)
  Progress Gauge:    [${colors.green}${bar}${colors.reset}] ${pct}%
  Messages Count:    ${this.conversationHistory.length} messages in context
  Compaction Status: ${pct > 75 ? `${colors.yellow}Compaction Recommended (/compact)${colors.reset}` : `${colors.green}Healthy${colors.reset}`}
`);
        return true;
      }

      case '/model': {
        const newModel = args[0]?.trim();
        if (!newModel) {
          const meta = MODEL_METADATA[this.model] || { name: this.model, provider: 'Unknown', contextWindow: 131072, desc: 'General coding' };
          console.log(`
${colors.bright}Current Active Model:${colors.reset} ${colors.green}${colors.bright}${this.model}${colors.reset} (${meta.name})
  Provider:       ${meta.provider}
  Context Window: ${meta.contextWindow.toLocaleString()} tokens
  Description:    ${meta.desc}

${colors.dim}To switch model:${colors.reset} ${colors.cyan}/model <model-name>${colors.reset} (e.g. /model intern-s1, /model k1.5)
${colors.dim}To view all models:${colors.reset} ${colors.cyan}/models${colors.reset}
`);
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
            data.data?.forEach(m => {
              const meta = MODEL_METADATA[m.id];
              const desc = meta ? ` - ${meta.name} (${(meta.contextWindow / 1024).toFixed(0)}k)` : '';
              console.log(`  • ${colors.cyan}${m.id.padEnd(20)}${colors.reset}${desc}`);
            });
            console.log('');
          } else {
            console.log(`Failed to fetch models: HTTP ${res.status}`);
          }
        } catch (e) {
          console.log(`Error connecting to ${this.apiUrl}: ${e.message}`);
        }
        return true;
      }

      case '/doctor': {
        console.log(`\n${colors.cyan}${colors.bright}Running Samsudin System Doctor Diagnostics...${colors.reset}\n`);

        const nodeOk = parseInt(process.versions.node.split('.')[0], 10) >= 18;
        console.log(`  ${nodeOk ? colors.green + '✔' : colors.red + '✖'}${colors.reset} Node.js Runtime:     ${process.version} (${process.platform} ${process.arch})`);

        const { getGitStatus } = await import('../tools/git-tools.mjs');
        const gitSt = await getGitStatus({ cwd: this.cwd });
        console.log(`  ${gitSt.isGitRepo ? colors.green + '✔' : colors.yellow + '⚠'}${colors.reset} Git Repository:     ${gitSt.isGitRepo ? `Active branch [${gitSt.branch}]` : 'Not a git repo'}`);

        let apiOk = false;
        let apiModelsCount = 0;
        try {
          const res = await fetch(`${this.apiUrl}/models`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            apiOk = true;
            apiModelsCount = data.data?.length || 0;
          }
        } catch {}
        console.log(`  ${apiOk ? colors.green + '✔' : colors.red + '✖'}${colors.reset} Backend API:        ${this.apiUrl} (${apiOk ? `Online, ${apiModelsCount} models` : 'Offline / Unreachable'})`);

        const auth = new AuthManager();
        const authStatus = auth.getStatus();
        const configuredCount = authStatus.providers.filter(p => p.isConfigured).length;
        const totalCount = authStatus.providers.length;
        console.log(`  ${configuredCount > 0 ? colors.green + '✔' : colors.yellow + '⚠'}${colors.reset} Credentials:       ${configuredCount} of ${totalCount} providers configured (${auth.credentialsFile})`);

        const rulesPath = path.resolve(this.cwd, 'SAMSUDIN.md');
        const rulesExist = fs.existsSync(rulesPath);
        console.log(`  ${rulesExist ? colors.green + '✔' : colors.dim + '•'}${colors.reset} Project Rules:      ${rulesExist ? 'SAMSUDIN.md active' : 'None (use /init to generate)'}`);

        console.log(`  ${colors.green}✔${colors.reset} Active Model:       ${this.model} | YOLO Mode: ${this.yolo ? 'ON' : 'OFF'}\n`);
        return true;
      }

      case '/init': {
        const rulesPath = path.resolve(this.cwd, 'SAMSUDIN.md');
        if (fs.existsSync(rulesPath)) {
          console.log(`${colors.yellow}✔ SAMSUDIN.md already exists in workspace:${colors.reset} ${rulesPath}\n`);
          return true;
        }

        const template = `# SAMSUDIN AGENT RULES

## Project Overview
This repository uses the **Samsudin Autonomous Coding Agent**.

## Guidelines for Samsudin
- Maintain documentation integrity and do not remove unrelated comments.
- Always verify changes with unit tests or lint commands before declaring completion.
- Keep file modifications targeted and minimal.
- Use best practices for JavaScript/Node.js ESM modules.

## Build and Test Commands
- Test: npm test
`;
        fs.writeFileSync(rulesPath, template, 'utf-8');
        console.log(`${colors.green}✔ Initialized project rulebook at:${colors.reset} ${rulesPath}\n`);
        return true;
      }

      case '/review': {
        const { getGitDiff } = await import('../tools/git-tools.mjs');
        const diffRes = await getGitDiff({ cwd: this.cwd });
        if (!diffRes.success || !diffRes.diff || !diffRes.diff.trim()) {
          console.log(`${colors.yellow}ℹ No uncommitted git changes found to review.${colors.reset}\n`);
          return true;
        }

        console.log(`\n${colors.cyan}Initiating autonomous code review for uncommitted diff...${colors.reset}\n`);
        await this.executeTurn(`Please perform a thorough code review of the following uncommitted git diff. Analyze code quality, potential bugs, edge cases, regression risks, and architectural best practices:\n\n\`\`\`diff\n${diffRes.diff}\n\`\`\``);
        return true;
      }

      case '/undo': {
        const { getGitStatus } = await import('../tools/git-tools.mjs');
        const st = await getGitStatus({ cwd: this.cwd });
        if (!st.isGitRepo) {
          console.log(`${colors.red}✖ Not a git repository. Cannot undo.${colors.reset}`);
          return true;
        }
        if (st.clean) {
          console.log(`${colors.yellow}ℹ Workspace is already clean. Nothing to undo.${colors.reset}`);
          return true;
        }

        const { execSync } = await import('node:child_process');
        try {
          execSync('git checkout -- .', { cwd: this.cwd, stdio: 'pipe' });
          console.log(`${colors.green}✔ Successfully reverted uncommitted changes in tracked files.${colors.reset}\n`);
        } catch (err) {
          console.log(`${colors.red}✖ Failed to revert changes: ${err.message}${colors.reset}\n`);
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
  Total Tokens:    ${s.usage?.totalTokens?.toLocaleString() || 0}
  Cost Savings:    ~$${s.usage?.savingsUsd?.toFixed(4) || '0.0000'} USD
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
