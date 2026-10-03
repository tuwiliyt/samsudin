#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { SamsudinREPL } from '../src/harness/repl.mjs';
import { ConfigManager } from '../src/config/config-manager.mjs';
import { OpenAIProvider } from '../src/providers/openai-provider.mjs';
import { printBanner, createEventHandler, colors } from '../src/utils/terminal-ui.mjs';

const options = {
  model: { type: 'string', short: 'm' },
  'api-url': { type: 'string', short: 'u', default: 'http://127.0.0.1:4318/v1' },
  'api-key': { type: 'string', short: 'k', default: 'dummy-key' },
  interactive: { type: 'boolean', short: 'i', default: false },
  yolo: { type: 'boolean', short: 'y', default: false },
  verbose: { type: 'boolean', short: 'v', default: false },
  steps: { type: 'string', short: 's', default: '25' },
  help: { type: 'boolean', short: 'h', default: false }
};

const POPULAR_MODELS = [
  { id: 'intern-s1', label: 'InternLM 2.5 Pro (intern-s1) [Verified Tool Caller]' },
  { id: 'ERINE-5.1', label: 'Baidu Wenxin 5.1 (ERINE-5.1)' },
  { id: 'k1.5', label: 'Kimi Moonshot 1.5 (k1.5)' },
  { id: 'mimo-flash', label: 'Xiaomi MiMo Flash (mimo-flash)' },
  { id: 'hy4-preview-g', label: 'Tencent Hunyuan 4 Preview (hy4-preview-g)' },
  { id: 'glm-4.5', label: 'Zhipu GLM-4.5 (glm-4.5)' },
  { id: 'qwen3.7-plus', label: 'Alibaba Qwen 3.7 Plus (qwen3.7-plus)' },
  { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat)' },
  { id: 'minimax-m2.7', label: 'MiniMax M2.7 (minimax-m2.7)' }
];

async function selectModelInteractively(apiUrl) {
  let availableModels = [];
  try {
    const res = await fetch(`${apiUrl}/models`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        availableModels = data.data.map(m => m.id);
      }
    }
  } catch {}

  console.log(`\n${colors.cyan}${colors.bright}Pilih Model AI untuk Eksekusi Harness:${colors.reset}`);
  POPULAR_MODELS.forEach((item, index) => {
    console.log(`  [${colors.yellow}${index + 1}${colors.reset}] ${item.label}`);
  });
  console.log(`  [${colors.yellow}${POPULAR_MODELS.length + 1}${colors.reset}] Masukkan model lainnya secara manual\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bright}Pilihan Anda [1-${POPULAR_MODELS.length + 1} atau nama model]: ${colors.reset}`, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      const num = parseInt(trimmed, 10);

      if (!isNaN(num) && num >= 1 && num <= POPULAR_MODELS.length) {
        resolve(POPULAR_MODELS[num - 1].id);
      } else if (num === POPULAR_MODELS.length + 1 || !trimmed) {
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question('Ketik nama model: ', (custom) => {
          rl2.close();
          resolve(custom.trim() || 'intern-s1');
        });
      } else {
        resolve(trimmed);
      }
    });
  });
}

async function main() {
  const { values, positionals } = parseArgs({
    options,
    allowPositionals: true,
    strict: false
  });

  if (values.help) {
    printBanner();
    console.log(`
Usage:
  samsudin [options] "<prompt/goal>"     Execute a single goal autonomously
  samsudin [options]                    Enter interactive REPL shell (like OpenCode / Claude Code)
  samsudin auth [provider]              Configure credentials for a specific provider
  samsudin auth import <file.json>      Import credentials exported by Chrome extension
  samsudin auth status                  Check status of all connected providers

Options:
  -m, --model <name>      Model identifier (e.g. intern-s1, ERINE-5.1, k1.5, mimo-flash, etc.)
  -u, --api-url <url>     OpenAI-compatible base API URL (default: http://127.0.0.1:4318/v1)
  -k, --api-key <key>     API Key (default: dummy-key or env OPENAI_API_KEY)
  -i, --interactive       Force interactive REPL mode
  -y, --yolo              Auto-approve all tool operations without prompting
  -v, --verbose           Show detailed token streaming and raw tool arguments
  -s, --steps <number>    Max agent execution steps (default: 25)
  -h, --help              Show this help message

REPL Slash Commands:
  /model <name>           Switch active model on the fly
  /models                 List available models from backend
  /clear                  Reset conversation history
  /compact                Force context compaction
  /tools                  View registered tools and schemas
  /stats                  Show session metrics & tool usage
  /git                    View git status & branch
  /diff                   View uncommitted git diff
  /exit                   Exit REPL
`);
    process.exit(0);
  }

  printBanner();

  // Subcommand: samsudin auth ...
  if (positionals[0] === 'auth') {
    const { handleAuthCommand } = await import('../src/cli/auth-cli.mjs');
    await handleAuthCommand(positionals.slice(1), process.cwd());
    return;
  }

  const configManager = new ConfigManager(process.cwd());
  const cfg = configManager.loadConfig();

  // Model resolution: CLI flag > ENV > Config file > Interactive prompt
  let chosenModel = values.model || process.env.SAMSUDIN_MODEL || cfg.defaultModel;
  if (!chosenModel && process.stdin.isTTY) {
    chosenModel = await selectModelInteractively(values['api-url']);
  }
  if (!chosenModel) {
    chosenModel = 'intern-s1';
  }

  const goal = positionals.join(' ').trim();

  // If no positional goal provided, or if --interactive is passed: Launch REPL Mode!
  if (!goal || values.interactive) {
    const repl = new SamsudinREPL({
      model: chosenModel,
      apiUrl: values['api-url'],
      apiKey: values['api-key'],
      yolo: Boolean(values.yolo),
      verbose: Boolean(values.verbose),
      maxSteps: parseInt(values.steps, 10) || 25,
      cwd: process.cwd()
    });
    await repl.start();
    return;
  }

  // One-off Autonomous Task Mode
  console.log(`${colors.cyan}Model Terpilih:${colors.reset} ${colors.bright}${chosenModel}${colors.reset}\n`);

  const provider = new OpenAIProvider({
    baseUrl: values['api-url'],
    apiKey: values['api-key'],
    model: chosenModel
  });

  const agent = new AgentLoop({
    provider,
    cwd: process.cwd(),
    yolo: Boolean(values.yolo),
    maxSteps: parseInt(values.steps, 10) || 25,
    onEvent: createEventHandler({ verbose: Boolean(values.verbose) })
  });

  try {
    await agent.runTask(goal);
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}Eksekusi gagal:${colors.reset} ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
