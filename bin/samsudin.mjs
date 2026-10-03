#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { OpenAIProvider } from '../src/providers/openai-provider.mjs';
import { printBanner, createEventHandler, colors } from '../src/utils/terminal-ui.mjs';

const options = {
  model: { type: 'string', short: 'm' },
  'api-url': { type: 'string', short: 'u', default: 'http://127.0.0.1:4318/v1' },
  'api-key': { type: 'string', short: 'k', default: 'dummy-key' },
  yolo: { type: 'boolean', short: 'y', default: false },
  verbose: { type: 'boolean', short: 'v', default: false },
  steps: { type: 'string', short: 's', default: '25' },
  help: { type: 'boolean', short: 'h', default: false }
};

const POPULAR_MODELS = [
  { id: 'ERINE-5.1', label: 'Baidu Wenxin 5.1 (ERINE-5.1)' },
  { id: 'hy4-preview-g', label: 'Tencent Hunyuan 4 Preview (hy4-preview-g)' },
  { id: 'k1.5', label: 'Kimi Moonshot 1.5 (k1.5)' },
  { id: 'glm-4.5', label: 'Zhipu GLM-4.5 (glm-4.5)' },
  { id: 'intern-s1', label: 'InternLM 2.5 Pro (intern-s1)' },
  { id: 'qwen3.7-plus', label: 'Alibaba Qwen 3.7 Plus (qwen3.7-plus)' },
  { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat)' },
  { id: 'minimax-m2.7', label: 'MiniMax M2.7 (minimax-m2.7)' },
  { id: 'mimo-flash', label: 'Xiaomi MiMo Flash (mimo-flash)' }
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
  } catch {
    // ignore fetch error, fallback to popular list
  }

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
        // Prompt for custom model name
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question('Ketik nama model: ', (custom) => {
          rl2.close();
          resolve(custom.trim() || 'ERINE-5.1');
        });
      } else {
        // Direct string typed
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
  samsudin [options] "<prompt/goal>"
  samsudin [options] (interactive mode)

Options:
  -m, --model <name>      Model identifier (e.g. ERINE-5.1, hy4-preview-g, k1.5, glm-4.5, etc.)
  -u, --api-url <url>     OpenAI-compatible base API URL (default: http://127.0.0.1:4318/v1)
  -k, --api-key <key>     API Key (default: dummy-key or env OPENAI_API_KEY)
  -y, --yolo              Auto-approve all tool operations without prompting
  -v, --verbose           Show detailed token streaming and raw tool arguments
  -s, --steps <number>    Max agent execution steps (default: 25)
  -h, --help              Show this help message

Examples:
  samsudin -m ERINE-5.1 "Buat landing page website untuk samsudin"
  samsudin -m hy4-preview-g --yolo "Audit dan perbaiki test suite"
`);
    process.exit(0);
  }

  printBanner();

  // Model resolution: CLI flag > ENV > Interactive Selection
  let chosenModel = values.model || process.env.SAMSUDIN_MODEL;
  if (!chosenModel) {
    if (process.stdin.isTTY) {
      chosenModel = await selectModelInteractively(values['api-url']);
    } else {
      chosenModel = 'ERINE-5.1'; // Fallback for non-interactive piped environments
    }
  }

  console.log(`${colors.cyan}Model Terpilih:${colors.reset} ${colors.bright}${chosenModel}${colors.reset}\n`);

  let goal = positionals.join(' ').trim();

  // If no positional goal provided, enter interactive prompt
  if (!goal) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    goal = await new Promise((resolve) => {
      rl.question(`${colors.cyan}${colors.bright}Apa tugas yang ingin Anda berikan kepada Samsudin?${colors.reset}\n> `, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!goal) {
    console.error(`${colors.red}Error: Tidak ada tugas yang diberikan.${colors.reset}`);
    process.exit(1);
  }

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
