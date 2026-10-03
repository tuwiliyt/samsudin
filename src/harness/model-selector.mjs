import readline from 'node:readline';
import { colors } from '../utils/terminal-ui.mjs';
import { PROVIDERS_META } from '../auth/provider-snippets.mjs';
import { runProviderWizard } from '../cli/auth-cli.mjs';

/**
 * Maps a model ID from the API to its underlying provider key.
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
 * Known friendly names and descriptions for popular models
 */
export const MODEL_FRIENDLY_INFO = {
  'intern-s1': { name: 'InternLM 2.5 (s1)', providerName: 'InternLM / OpenXLab' },
  'intern-s2-0911-web': { name: 'Intern-S2 (397B)', providerName: 'InternLM / OpenXLab' },
  'intern-s1-pro': { name: 'Intern-S1-Pro (1T)', providerName: 'InternLM / OpenXLab' },
  'k2': { name: 'Kimi k2 Flagship', providerName: 'Moonshot AI' },
  'k1.5': { name: 'Kimi k1.5', providerName: 'Moonshot AI' },
  'k1.5-thinking': { name: 'Kimi k1.5 Thinking', providerName: 'Moonshot AI' },
  'deepseek-reasoner': { name: 'DeepSeek R1 (Reasoner)', providerName: 'DeepSeek' },
  'deepseek-chat': { name: 'DeepSeek V3', providerName: 'DeepSeek' },
  'deepseek-v4-flash': { name: 'DeepSeek v4 Flash', providerName: 'DeepSeek' },
  'deepseek-v4-pro': { name: 'DeepSeek v4 Pro', providerName: 'DeepSeek' },
  'qwen3.7-plus': { name: 'Qwen 3.7 Plus', providerName: 'Alibaba Qwen' },
  'qwen3.8-max': { name: 'Qwen 3.8 Max', providerName: 'Alibaba Qwen' },
  'glm-4.5': { name: 'Zhipu GLM-4.5', providerName: 'Zhipu AI (Z.ai)' },
  'glm-5.3-flash': { name: 'Zhipu GLM-5.3 Flash', providerName: 'Zhipu AI (Z.ai)' },
  'minimax-m2.7': { name: 'MiniMax M2.7', providerName: 'MiniMax Agent' },
  'MiniMax-M3': { name: 'MiniMax M3', providerName: 'MiniMax Agent' },
  'mimo-flash': { name: 'Xiaomi MiMo Flash', providerName: 'Xiaomi AI' },
  'hy4-preview-g': { name: 'Tencent Hunyuan 4', providerName: 'Tencent' },
  'ERINE-5.1': { name: 'Baidu ERNIE 5.1', providerName: 'Baidu Wenxin' },
  'gpt-4o': { name: 'ChatGPT GPT-4o', providerName: 'OpenAI' }
};

/**
 * Default fallback list of models if API endpoint is unreachable
 */
export const FALLBACK_MODELS = [
  'intern-s1',
  'k2',
  'k1.5',
  'deepseek-reasoner',
  'deepseek-chat',
  'qwen3.7-plus',
  'glm-4.5',
  'minimax-m2.7',
  'mimo-flash',
  'hy4-preview-g',
  'ERINE-5.1',
  'gpt-4o'
];

/**
 * Fetch models from API and categorize them by active/ready status first.
 */
export async function fetchAndCategorizeModels({ apiUrl, authManager, currentModel }) {
  let modelIds = [];
  try {
    const res = await fetch(`${apiUrl}/models`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        modelIds = data.data.map(m => m.id);
      }
    }
  } catch {}

  if (modelIds.length === 0) {
    modelIds = [...FALLBACK_MODELS];
  }

  const authStatus = authManager.getStatus();
  const configuredProviders = new Set(
    authStatus.providers.filter(p => p.isConfigured).map(p => p.id)
  );

  const readyModels = [];
  const setupNeededModels = [];

  for (const id of modelIds) {
    const providerKey = resolveModelProvider(id);
    const meta = providerKey ? PROVIDERS_META[providerKey] : null;
    const friendly = MODEL_FRIENDLY_INFO[id] || {};
    const providerName = friendly.providerName || meta?.name || providerKey || 'Unknown';
    const isConfigured = providerKey ? configuredProviders.has(providerKey) : false;
    const isActiveModel = id === currentModel;

    const entry = {
      id,
      name: friendly.name || id,
      providerKey,
      providerName,
      isConfigured,
      isActiveModel
    };

    if (isConfigured) {
      readyModels.push(entry);
    } else {
      setupNeededModels.push(entry);
    }
  }

  // Active model stays at the very top of ready models
  readyModels.sort((a, b) => {
    if (a.isActiveModel) return -1;
    if (b.isActiveModel) return 1;
    return a.id.localeCompare(b.id);
  });

  setupNeededModels.sort((a, b) => {
    if (a.providerKey !== b.providerKey) {
      return (a.providerKey || '').localeCompare(b.providerKey || '');
    }
    return a.id.localeCompare(b.id);
  });

  // Ready models come first!
  const allOrdered = [...readyModels, ...setupNeededModels];

  return {
    readyModels,
    setupNeededModels,
    allOrdered
  };
}

/**
 * Interactive model selector using Tab / Shift-Tab / Up / Down and Enter.
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
    console.log(`\n${colors.bright}Available Models (Active / Configured First):${colors.reset}`);
    models.forEach((m, idx) => {
      const activeTag = m.isActiveModel ? ` ${colors.cyan}[ACTIVE]${colors.reset}` : '';
      const readyTag = m.isConfigured ? `${colors.green}✔ READY${colors.reset}` : `${colors.gray}○ SETUP NEEDED${colors.reset}`;
      console.log(`  [${idx + 1}] ${m.id.padEnd(26)} ${readyTag} (${m.providerName})${activeTag}`);
    });
    console.log('');
    return null;
  }

  return new Promise((resolve) => {
    let selectedIndex = 0;
    // Start with current active model selected if present
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
      lines.push(`${colors.cyan}│${colors.reset}  ${colors.bright}Pilih Model AI (Tekan [Tab] / [↑] / [↓] untuk geser, [Enter] memilih)  ${colors.reset}${colors.cyan}│${colors.reset}`);
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
          statusBadge = `${colors.green}${colors.bright}[ACTIVE]${colors.reset}`;
        } else if (m.isConfigured) {
          statusBadge = `${colors.green}✔ READY${colors.reset}`;
        } else {
          statusBadge = `${colors.yellow}○ SETUP NEEDED${colors.reset}`;
        }

        const modelLabel = isSelected
          ? `${colors.bright}${colors.cyan}${m.id.padEnd(26)}${colors.reset}`
          : `${m.id.padEnd(26)}`;

        const prov = `${colors.dim}(${m.providerName})${colors.reset}`;
        lines.push(`  ${cursor} ${modelLabel} ${statusBadge.padEnd(20)} ${prov}`);
      }

      if (windowStart + windowSize < models.length) {
        lines.push(`${colors.dim}    ▼ ... ${models.length - (windowStart + windowSize)} model lainnya di bawah ...${colors.reset}`);
      }

      lines.push(`${colors.dim}  [Tab / ↓] Berikutnya  •  [Shift-Tab / ↑] Sebelumnya  •  [Enter] Pilih  •  [Esc] Batal${colors.reset}\n`);

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
      if (!key) return;

      // Enter / Return: confirm selection
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(models[selectedIndex]);
        return;
      }

      // Escape / Ctrl+C / q: cancel
      if (key.name === 'escape' || (key.ctrl && key.name === 'c') || str === 'q') {
        cleanup();
        resolve(null);
        return;
      }

      // Tab or Down arrow: next
      if (key.name === 'tab') {
        if (key.shift) {
          selectedIndex = (selectedIndex - 1 + models.length) % models.length;
        } else {
          selectedIndex = (selectedIndex + 1) % models.length;
        }
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % models.length;
        render();
        return;
      }

      // Up arrow: previous
      if (key.name === 'up') {
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
 * 1. Categorizes models with active/ready ones first.
 * 2. Prompts user interactively with Tab/Enter.
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
