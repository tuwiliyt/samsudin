#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { OpenAIProvider } from '../src/providers/openai-provider.mjs';
import { printBanner, createEventHandler, colors } from '../src/utils/terminal-ui.mjs';

const options = {
  model: { type: 'string', short: 'm', default: 'deepseek-chat' },
  'api-url': { type: 'string', short: 'u', default: 'http://127.0.0.1:3000/v1' },
  'api-key': { type: 'string', short: 'k', default: 'dummy-key' },
  yolo: { type: 'boolean', short: 'y', default: false },
  verbose: { type: 'boolean', short: 'v', default: false },
  steps: { type: 'string', short: 's', default: '25' },
  help: { type: 'boolean', short: 'h', default: false }
};

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
  -m, --model <name>      Model identifier (default: deepseek-chat, or ERINE-5.1, hy4-preview-g, qwen3-max, glm-4-plus, etc.)
  -u, --api-url <url>     OpenAI-compatible base API URL (default: http://127.0.0.1:3000/v1)
  -k, --api-key <key>     API Key (default: dummy-key or env OPENAI_API_KEY)
  -y, --yolo              Auto-approve all tool operations without prompting
  -v, --verbose           Show detailed token streaming and raw tool arguments
  -s, --steps <number>    Max agent execution steps (default: 25)
  -h, --help              Show this help message

Examples:
  samsudin "Audit and fix all syntax errors in src/"
  samsudin --model ERINE-5.1 "Refactor database query to use parameterized inputs"
  samsudin --yolo "Run tests, find failing test, and patch the bug"
`);
    process.exit(0);
  }

  printBanner();

  let goal = positionals.join(' ').trim();

  // If no positional goal provided, enter interactive prompt
  if (!goal) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    goal = await new Promise((resolve) => {
      rl.question(`${colors.cyan}${colors.bright}What task should Samsudin execute?${colors.reset}\n> `, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!goal) {
    console.error(`${colors.red}Error: No task provided.${colors.reset}`);
    process.exit(1);
  }

  const provider = new OpenAIProvider({
    baseUrl: values['api-url'],
    apiKey: values['api-key'],
    model: values.model
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
    console.error(`\n${colors.red}${colors.bright}Execution failed:${colors.reset} ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
