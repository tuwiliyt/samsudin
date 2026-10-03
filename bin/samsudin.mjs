#!/usr/bin/env node
import process from 'node:process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { PermissionGate } from '../src/harness/permissions.mjs';
import { CheckpointManager } from '../src/harness/checkpoint-manager.mjs';
import { runArchitectEditor } from '../src/harness/architect.mjs';
import { SamsudinREPL } from '../src/harness/repl.mjs';
import { ConfigManager } from '../src/config/config-manager.mjs';
import { OpenAIProvider } from '../src/providers/openai-provider.mjs';
import { AuthManager } from '../src/auth/auth-manager.mjs';
import { handleModelSelectionFlow } from '../src/harness/model-selector.mjs';
import { printBanner, createEventHandler, colors } from '../src/utils/terminal-ui.mjs';

const options = {
  model: { type: 'string', short: 'm' },
  'api-url': { type: 'string', short: 'u', default: 'http://127.0.0.1:4318/v1' },
  'api-key': { type: 'string', short: 'k', default: 'dummy-key' },
  interactive: { type: 'boolean', short: 'i', default: false },
  yolo: { type: 'boolean', short: 'y', default: false },
  'full-auto': { type: 'boolean', default: false },
  mode: { type: 'string' },
  plan: { type: 'boolean', default: false },
  architect: { type: 'string' },
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
  -y, --yolo              Auto-approve all tool operations (alias of --full-auto)
      --mode <name>       Approval mode: suggest | auto-edit | full-auto
      --full-auto         Same as --mode full-auto
      --plan              Read-only PLAN mode: investigate and output a plan, modify nothing
      --architect <model> Architect/Editor: <model> plans (read-only), --model implements
  -v, --verbose           Show detailed token streaming and raw tool arguments
  -s, --steps <number>    Max agent execution steps (default: 25)
  -h, --help              Show this help message

REPL Slash Commands:
  /model <name>           Switch active model on the fly
  /models                 List available models from backend
  /plan [goal] | /act     Toggle read-only plan mode
  /mode [name]            Show/set approval mode
  /architect <m>|off      Two-model architect/editor workflow
  /checkpoints | /rewind  List / restore per-turn file checkpoints
  /usage /tokens /doctor  Usage, context gauge, diagnostics
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
    const authManager = new AuthManager(process.cwd());
    const sel = await handleModelSelectionFlow({
      apiUrl: values['api-url'],
      authManager,
      currentModel: 'intern-s1'
    });
    chosenModel = sel.model || 'intern-s1';
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
      yolo: Boolean(values.yolo || values['full-auto']),
      mode: values.mode,
      plan: Boolean(values.plan),
      architectModel: values.architect,
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

  const gate = new PermissionGate({
    yolo: Boolean(values.yolo || values['full-auto']),
    mode: values.mode,
    planMode: Boolean(values.plan),
    cwd: process.cwd()
  });
  const checkpoints = new CheckpointManager(process.cwd());
  const onEvent = createEventHandler({ verbose: Boolean(values.verbose) });
  const maxSteps = parseInt(values.steps, 10) || 25;

  try {
    if (values.architect && !values.plan) {
      await runArchitectEditor({
        goal,
        architectProvider: new OpenAIProvider({ baseUrl: values['api-url'], apiKey: values['api-key'], model: values.architect }),
        editorProvider: provider,
        cwd: process.cwd(),
        maxSteps,
        editorGate: gate,
        checkpointManager: checkpoints,
        onEvent
      });
    } else {
      const agent = new AgentLoop({
        provider,
        cwd: process.cwd(),
        maxSteps,
        permissionGate: gate,
        checkpointManager: values.plan ? null : checkpoints,
        onEvent
      });
      await agent.runTask(goal);
    }
  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}Eksekusi gagal:${colors.reset} ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
