import readline from 'node:readline';
import { AuthManager } from '../auth/auth-manager.mjs';
import { PROVIDERS_META } from '../auth/provider-snippets.mjs';
import { colors } from '../utils/terminal-ui.mjs';

/**
 * CLI Handler for 'samsudin auth' commands
 */
export async function handleAuthCommand(args = [], cwd = process.cwd()) {
  const authManager = new AuthManager(cwd);
  const subCommand = args[0]?.toLowerCase();

  // Subcommand 1: 'samsudin auth status'
  if (subCommand === 'status') {
    const status = authManager.getStatus();
    console.log(`\n${colors.bright}Samsudin Provider Credentials Status:${colors.reset}`);
    console.log(`${colors.dim}Storage File: ${status.credentialsFile}${colors.reset}\n`);

    status.providers.forEach(p => {
      const icon = p.isConfigured ? `${colors.green}✔ CONNECTED${colors.reset}` : `${colors.gray}○ UNCONFIGURED${colors.reset}`;
      const activeBadge = p.isActive ? ` ${colors.cyan}${colors.bright}[ACTIVE]${colors.reset}` : '';
      const updated = p.updatedAt ? `${colors.dim}(Updated: ${new Date(p.updatedAt).toLocaleDateString()})${colors.reset}` : '';
      console.log(`  ${p.name.padEnd(18)} ${icon.padEnd(25)} ${activeBadge} ${updated}`);
    });

    console.log(`\n${colors.bright}Active Default Provider:${colors.reset} ${colors.cyan}${status.activeProvider || 'None'}${colors.reset}`);
    console.log(`${colors.dim}To configure a provider: samsudin auth <provider>${colors.reset}\n`);
    return;
  }

  // Subcommand 2: 'samsudin auth import <file>'
  if (subCommand === 'import') {
    const filePath = args[1];
    if (!filePath) {
      console.error(`${colors.red}Error: File path required. Usage: samsudin auth import <credentials.json>${colors.reset}`);
      return;
    }
    try {
      const res = await authManager.importCredentialsFile(filePath);
      console.log(`\n${colors.green}✔ Successfully imported credentials!${colors.reset}`);
      console.log(`  Imported ${res.importedCount} provider(s): ${res.importedKeys.join(', ')}`);
      console.log(`  Active Provider set to: ${colors.bright}${res.activeProvider}${colors.reset}\n`);
    } catch (err) {
      console.error(`\n${colors.red}Import failed:${colors.reset} ${err.message}\n`);
    }
    return;
  }

  // Subcommand 3: 'samsudin auth switch <provider>'
  if (subCommand === 'switch') {
    const target = args[1];
    if (!target) {
      console.error(`${colors.red}Usage: samsudin auth switch <provider>${colors.reset}`);
      return;
    }
    try {
      const active = authManager.setActiveProvider(target);
      console.log(`\n${colors.green}✔ Active default provider switched to:${colors.reset} ${colors.bright}${active}${colors.reset}\n`);
    } catch (err) {
      console.error(`\n${colors.red}Failed:${colors.reset} ${err.message}\n`);
    }
    return;
  }

  // Subcommand 4: Specific provider setup (e.g. 'samsudin auth deepseek' or 'samsudin auth minimax')
  let providerKey = subCommand;
  if (providerKey && PROVIDERS_META[providerKey]) {
    await runProviderWizard(authManager, providerKey);
    return;
  }

  // Subcommand 5: Interactive menu ('samsudin auth')
  console.log(`\n${colors.cyan}${colors.bright}Samsudin Modular Provider Authentication:${colors.reset}`);
  console.log(`${colors.dim}Select a single provider you want to connect:${colors.reset}\n`);

  const keys = Object.keys(PROVIDERS_META);
  keys.forEach((key, idx) => {
    const meta = PROVIDERS_META[key];
    console.log(`  [${colors.yellow}${idx + 1}${colors.reset}] ${meta.name.padEnd(16)} (Model: ${meta.model})`);
  });
  console.log(`  [${colors.yellow}i${colors.reset}] Import from Chrome Extension (credentials.json)`);
  console.log(`  [${colors.yellow}s${colors.reset}] View Status\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`${colors.bright}Pilihan Anda [1-${keys.length}, i, s]: ${colors.reset}`, async (ans) => {
    rl.close();
    const choice = ans.trim().toLowerCase();

    if (choice === 's') {
      await handleAuthCommand(['status'], cwd);
      return;
    }

    if (choice === 'i') {
      const rlFile = readline.createInterface({ input: process.stdin, output: process.stdout });
      rlFile.question('Path to credentials.json: ', async (filePath) => {
        rlFile.close();
        if (filePath.trim()) {
          await handleAuthCommand(['import', filePath.trim()], cwd);
        }
      });
      return;
    }

    const num = parseInt(choice, 10);
    if (!isNaN(num) && num >= 1 && num <= keys.length) {
      await runProviderWizard(authManager, keys[num - 1]);
    } else if (keys.includes(choice)) {
      await runProviderWizard(authManager, choice);
    } else {
      console.log('Cancelled.');
    }
  });
}

async function runProviderWizard(authManager, providerKey) {
  const meta = PROVIDERS_META[providerKey];
  console.log(`\n${colors.cyan}${colors.bright}--- Setup Provider: ${meta.name} ---${colors.reset}`);
  console.log(`${colors.bright}Website:${colors.reset} ${meta.url}`);
  console.log(`${colors.dim}${meta.instruction}${colors.reset}\n`);

  console.log(`${colors.yellow}Console Snippet (Copy-paste this into F12 DevTools Console):${colors.reset}`);
  console.log(`\x1b[36m${meta.consoleSnippet}\x1b[0m\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${colors.bright}Paste Token / Cookie / API Key here: ${colors.reset}`, (rawInput) => {
      rl.close();
      const val = rawInput.trim();
      if (!val) {
        console.log(`${colors.red}Input was empty. Aborted.${colors.reset}\n`);
        resolve();
        return;
      }

      const payload = {
        token: val,
        raw: val
      };

      authManager.setProvider(providerKey, payload);
      authManager.setActiveProvider(providerKey);

      console.log(`\n${colors.green}✔ ${meta.name} successfully connected!${colors.reset}`);
      console.log(`${colors.dim}Credentials saved to ~/.samsudin/credentials.json${colors.reset}`);
      console.log(`Default model is now: ${colors.cyan}${meta.model}${colors.reset}\n`);
      resolve();
    });
  });
}
