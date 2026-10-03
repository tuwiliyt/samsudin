import readline from 'node:readline';
import { colors } from '../utils/terminal-ui.mjs';
import { PROVIDERS_META } from '../auth/provider-snippets.mjs';
import { runProviderWizard } from '../cli/auth-cli.mjs';

/**
 * Maps a model ID to its underlying provider key.
 */
export function resolveModelProvider(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  const m = modelId.toLowerCase();
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.startsWith('intern')) return 'internlm';
  if (m.startsWith('k1') || m.startsWith('k2') || m === 'kimi') return 'kimi';
  if (m.startsWith('qwen')) return 'qwen';
  if (m.startsWith('glm') || m.startsWith('x-preview') || m === 'zai') return 'zai';
  if (m.startsWith('minimax')) return 'minimax';
  if (m.startsWith('mimo')) return 'mimo';
  if (m.startsWith('hy') || m.startsWith('hunyuan')) return 'hunyuan';
  if (m.startsWith('erine') || m.startsWith('ernie') || m.startsWith('wenxin') || m === 'smartmode') return 'wenxin';
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('chatgpt')) return 'chatgpt';
  return null;
}

/**
 * Curated list of primary / flagship models across all 10 providers.
 * Keeps the picker concise, elegant, and relevant without dumping 80+ internal variants.
 */
export const CURATED_MODELS = [
  // InternLM (OpenXLab)
  { id: 'intern-s1', name: 'InternLM 2.5 Pro', providerKey: 'internlm', providerName: 'InternLM / OpenXLab' },
  { id: 'intern-s2-0911-web', name: 'Intern-S2 (397B)', providerKey: 'internlm', providerName: 'InternLM / OpenXLab' },

  // Kimi Moonshot AI
  { id: 'k2', name: 'Kimi k2 Flagship', providerKey: 'kimi', providerName: 'Moonshot AI' },
  { id: 'k1.5', name: 'Kimi k1.5', providerKey: 'kimi', providerName: 'Moonshot AI' },
  { id: 'k1.5-thinking', name: 'Kimi k1.5 Thinking', providerKey: 'kimi', providerName: 'Moonshot AI' },

  // DeepSeek
  { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoner)', providerKey: 'deepseek', providerName: 'DeepSeek' },
  { id: 'deepseek-chat', name: 'DeepSeek-V3', providerKey: 'deepseek', providerName: 'DeepSeek' },

  // Alibaba Qwen
  { id: 'qwen3.8-max', name: 'Qwen 3.8 Max', providerKey: 'qwen', providerName: 'Alibaba Qwen' },
  { id: 'qwen3.7-plus', name: 'Qwen 3.7 Plus', providerKey: 'qwen', providerName: 'Alibaba Qwen' },

  // Zhipu GLM
  { id: 'glm-5.3-flash', name: 'Zhipu GLM-5.3 Flash', providerKey: 'zai', providerName: 'Zhipu AI' },
  { id: 'glm-4.5', name: 'Zhipu GLM-4.5', providerKey: 'zai', providerName: 'Zhipu AI' },

  // MiniMax
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', providerKey: 'minimax', providerName: 'MiniMax Agent' },
  { id: 'MiniMax-M3', name: 'MiniMax M3', providerKey: 'minimax', providerName: 'MiniMax Agent' },

  // Xiaomi MiMo
  { id: 'mimo-flash', name: 'Xiaomi MiMo Flash', providerKey: 'mimo', providerName: 'Xiaomi AI' },

  // Tencent Hunyuan
  { id: 'hy4-preview-g', name: 'Tencent Hunyuan 4', providerKey: 'hunyuan', providerName: 'Tencent Hunyuan' },

  // Baidu Wenxin
  { id: 'ERINE-5.1', name: 'Baidu ERNIE 5.1', providerKey: 'wenxin', providerName: 'Baidu Wenxin' },

  // OpenAI ChatGPT
  { id: 'gpt-4o', name: 'ChatGPT GPT-4o', providerKey: 'chatgpt', providerName: 'OpenAI' }
];

/**
 * Categorize curated models with current active model first,
 * followed by ready-to-use models, then setup-needed models.
 */
export async function fetchAndCategorizeModels({ apiUrl, authManager, currentModel }) {
  const authStatus = authManager.getStatus();
  const configuredProviders = new Set(
    authStatus.providers.filter(p => p.isConfigured).map(p => p.id)
  );

  const modelPool = [...CURATED_MODELS];

  // If current model is not in curated pool, include it at the top
  if (currentModel && !modelPool.some(m => m.id === currentModel)) {
    const provKey = resolveModelProvider(currentModel) || 'unknown';
    const meta = PROVIDERS_META[provKey];
    modelPool.unshift({
      id: currentModel,
      name: currentModel,
      providerKey: provKey,
      providerName: meta?.name || provKey
    });
  }

  const readyModels = [];
  const setupNeededModels = [];

  for (const m of modelPool) {
    const isConfigured = Boolean(m.providerKey && configuredProviders.has(m.providerKey));
    const isActiveModel = m.id === currentModel;

    const entry = {
      ...m,
      isConfigured,
      isActiveModel
    };

    if (isConfigured) {
      readyModels.push(entry);
    } else {
      setupNeededModels.push(entry);
    }
  }

  // Active model is always first in ready models
  readyModels.sort((a, b) => {
    if (a.isActiveModel) return -1;
    if (b.isActiveModel) return 1;
    return a.id.localeCompare(b.id);
  });

  // Setup-needed models grouped by provider
  setupNeededModels.sort((a, b) => {
    if (a.providerKey !== b.providerKey) {
      return (a.providerKey || '').localeCompare(b.providerKey || '');
    }
    return a.id.localeCompare(b.id);
  });

  const allOrdered = [...readyModels, ...setupNeededModels];

  return {
    readyModels,
    setupNeededModels,
    allOrdered
  };
}

/**
 * Interactive model selector using Up Arrow, Down Arrow, Tab, Shift-Tab, and Enter.
 */
export async function promptModelInteractive({
  models,
  currentModel,
  stdin = process.stdin,
  stdout = process.stdout
}) {
  if (!models || models.length === 0) return null;

  // Fallback for non-TTY (tests, scripts, pipes)
  if (!stdin.isTTY) {
    console.log(`\n${colors.bright}Daftar Model AI (Model Aktif Didahulukan):${colors.reset}`);
    models.forEach((m, idx) => {
      const activeTag = m.isActiveModel ? ` ${colors.cyan}${colors.bright}[SEDANG AKTIF]${colors.reset}` : '';
      const readyTag = m.isConfigured ? `${colors.green}✔ Akun Terhubung${colors.reset}` : `${colors.yellow}○ Perlu Setup${colors.reset}`;
      console.log(`  [${idx + 1}] ${m.id.padEnd(24)} ${readyTag.padEnd(22)} (${m.providerName})${activeTag}`);
    });
    console.log('');
    return null;
  }

  return new Promise((resolve) => {
    let selectedIndex = 0;
    const activeIdx = models.findIndex(m => m.id === currentModel);
    if (activeIdx >= 0) selectedIndex = activeIdx;

    const windowSize = Math.min(12, models.length);
    let windowStart = 0;
    let lastRenderedLines = 0;

    const wasRaw = Boolean(stdin.isRaw);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();

    function updateWindow() {
      if (selectedIndex < windowStart) {
        windowStart = selectedIndex;
      } else if (selectedIndex >= windowStart + windowSize) {
        windowStart = selectedIndex - windowSize + 1;
      }
    }

    function render() {
      updateWindow();
      const lines = [];

      lines.push(`${colors.cyan}${colors.bright}┌────────────────────────────────────────────────────────────────────────┐${colors.reset}`);
      lines.push(`${colors.cyan}│${colors.reset}  ${colors.bright}PILIH MODEL AI (Gunakan [↑] / [↓] / [Tab] untuk navigasi, [Enter] pilih)${colors.reset}${colors.cyan}│${colors.reset}`);
      lines.push(`${colors.cyan}└────────────────────────────────────────────────────────────────────────┘${colors.reset}`);

      if (windowStart > 0) {
        lines.push(`${colors.dim}    ▲ ... ${windowStart} model lainnya di atas ...${colors.reset}`);
      }

      for (let i = windowStart; i < windowStart + windowSize && i < models.length; i++) {
        const m = models[i];
        const isSelected = i === selectedIndex;
        const cursor = isSelected ? `${colors.cyan}${colors.bright}❯${colors.reset}` : ' ';

        let statusBadge = '';
        if (m.isActiveModel) {
          statusBadge = `${colors.green}${colors.bright}[SEDANG AKTIF]${colors.reset}`;
        } else if (m.isConfigured) {
          statusBadge = `${colors.green}✔ Akun Terhubung${colors.reset}`;
        } else {
          statusBadge = `${colors.yellow}○ Perlu Setup${colors.reset}`;
        }

        const modelLabel = isSelected
          ? `${colors.bright}${colors.cyan}${m.id.padEnd(24)}${colors.reset}`
          : `${m.id.padEnd(24)}`;

        const prov = `${colors.dim}(${m.providerName})${colors.reset}`;
        lines.push(`  ${cursor} ${modelLabel} ${statusBadge.padEnd(26)} ${prov}`);
      }

      if (windowStart + windowSize < models.length) {
        lines.push(`${colors.dim}    ▼ ... ${models.length - (windowStart + windowSize)} model lainnya di bawah ...${colors.reset}`);
      }

      lines.push(`${colors.dim}  [↑ / ↓ / Tab] Pindah Pilihan  •  [Enter] Pilih Model  •  [Esc / q] Batal${colors.reset}\n`);

      if (lastRenderedLines > 0) {
        stdout.write(`\x1b[${lastRenderedLines}A\x1b[0J`);
      }
      stdout.write(lines.join('\n'));
      lastRenderedLines = lines.length;
    }

    function cleanup() {
      stdin.removeListener('keypress', onKey);
      if (stdin.setRawMode) {
        stdin.setRawMode(wasRaw);
      }
      if (lastRenderedLines > 0) {
        stdout.write(`\x1b[${lastRenderedLines}A\x1b[0J`);
      }
    }

    function onKey(str, key) {
      // Robust detection for Down arrow: key.name or escape sequences or 'j'
      const isDown = (key && key.name === 'down') || str === '\x1b[B' || str === '\x1bOB' || str === 'j';

      // Robust detection for Up arrow: key.name or escape sequences or 'k'
      const isUp = (key && key.name === 'up') || str === '\x1b[A' || str === '\x1bOA' || str === 'k';

      // Tab key
      const isTab = (key && key.name === 'tab' && !key.shift) || str === '\t';
      const isShiftTab = (key && key.name === 'tab' && key.shift) || str === '\x1b[Z';

      // Enter key
      const isEnter = (key && (key.name === 'return' || key.name === 'enter')) || str === '\r' || str === '\n';

      // Cancel key
      const isCancel = (key && key.name === 'escape') || (key && key.ctrl && key.name === 'c') || str === '\x1b' || str === 'q' || str === '\u0003';

      if (isEnter) {
        cleanup();
        resolve(models[selectedIndex]);
        return;
      }

      if (isCancel) {
        cleanup();
        resolve(null);
        return;
      }

      if (isDown || isTab) {
        selectedIndex = (selectedIndex + 1) % models.length;
        render();
        return;
      }

      if (isUp || isShiftTab) {
        selectedIndex = (selectedIndex - 1 + models.length) % models.length;
        render();
        return;
      }
    }

    stdin.on('keypress', onKey);
    render();
  });
}

/**
 * Complete model selection workflow:
 * 1. Categorizes curated models with active model and configured ones first.
 * 2. Prompts user interactively with Arrow Keys, Tab, and Enter.
 * 3. If selected model is not configured, triggers credential wizard on the fly.
 * 4. Returns { model, switched, justConfigured }.
 */
export async function handleModelSelectionFlow({
  apiUrl,
  authManager,
  currentModel,
  stdin = process.stdin,
  stdout = process.stdout
}) {
  const { allOrdered } = await fetchAndCategorizeModels({ apiUrl, authManager, currentModel });

  const selected = await promptModelInteractive({
    models: allOrdered,
    currentModel,
    stdin,
    stdout
  });

  if (!selected) {
    console.log(`${colors.dim}Pemilihan model dibatalkan. Model tetap:${colors.reset} ${colors.cyan}${currentModel}${colors.reset}\n`);
    return { model: currentModel, switched: false, justConfigured: false };
  }

  // Case 1: Model is already configured and ready to use
  if (selected.isConfigured) {
    console.log(`\n${colors.green}✔ Beralih ke model aktif:${colors.reset} ${colors.bright}${colors.cyan}${selected.id}${colors.reset} ${colors.dim}(${selected.providerName})${colors.reset}\n`);
    return { model: selected.id, switched: true, justConfigured: false };
  }

  // Case 2: Model is NOT configured -> Trigger credential setup wizard
  console.log(`\n${colors.yellow}⚠ Model '${selected.id}' membutuhkan kredensial untuk provider '${selected.providerName}'.${colors.reset}`);
  console.log(`${colors.cyan}Memulai wizard pengambilan kredensial untuk ${selected.providerName}...${colors.reset}`);

  const success = await runProviderWizard(authManager, selected.providerKey);

  if (success) {
    const freshStatus = authManager.getStatus();
    const isNowConfigured = freshStatus.providers.find(p => p.id === selected.providerKey)?.isConfigured;

    if (isNowConfigured) {
      console.log(`\n${colors.green}✔ Kredensial ${selected.providerName} berhasil dikonfigurasi!${colors.reset}`);
      console.log(`${colors.green}✔ Beralih ke model aktif:${colors.reset} ${colors.bright}${colors.cyan}${selected.id}${colors.reset}\n`);
      return { model: selected.id, switched: true, justConfigured: true };
    }
  }

  console.log(`\n${colors.yellow}Kredensial belum lengkap. Model tetap:${colors.reset} ${colors.cyan}${currentModel}${colors.reset}\n`);
  return { model: currentModel, switched: false, justConfigured: false };
}
