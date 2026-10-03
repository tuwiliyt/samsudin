/**
 * Browser console snippets and guide instructions for the 10 supported AI providers.
 * Users can paste these snippets into DevTools Console (F12) to copy credentials in 3 seconds.
 */

export const PROVIDERS_META = {
  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    model: 'deepseek-chat',
    fields: ['token'],
    consoleSnippet: `copy(JSON.parse(localStorage.getItem('userToken') || '{}').value || localStorage.getItem('userToken') || document.cookie)`,
    instruction: 'Open https://chat.deepseek.com, login, press F12 -> Console, paste the snippet, press Enter, then paste here.'
  },
  minimax: {
    name: 'MiniMax',
    url: 'https://agent.minimaxi.com',
    model: 'minimax-m2.7',
    fields: ['token'],
    consoleSnippet: `copy(localStorage.getItem('token') || localStorage.getItem('access_token') || document.cookie)`,
    instruction: 'Open https://agent.minimaxi.com, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  kimi: {
    name: 'Kimi Moonshot',
    url: 'https://kimi.moonshot.cn',
    model: 'k1.5',
    fields: ['access_token'],
    consoleSnippet: `copy(localStorage.getItem('access_token') || document.cookie)`,
    instruction: 'Open https://kimi.moonshot.cn, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  wenxin: {
    name: 'Baidu Wenxin',
    url: 'https://wenxin.baidu.com',
    model: 'ERINE-5.1',
    fields: ['cookies'],
    consoleSnippet: `copy(document.cookie)`,
    instruction: 'Open https://wenxin.baidu.com, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  hunyuan: {
    name: 'Tencent Hunyuan',
    url: 'https://aistudio.tencent.ai',
    model: 'hy4-preview-g',
    fields: ['cookies'],
    consoleSnippet: `copy(document.cookie)`,
    instruction: 'Open https://aistudio.tencent.ai, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  qwen: {
    name: 'Alibaba Qwen',
    url: 'https://chat.qwenlm.ai',
    model: 'qwen3.7-plus',
    fields: ['token'],
    consoleSnippet: `copy(document.cookie + '||' + (localStorage.getItem('token') || ''))`,
    instruction: 'Open https://chat.qwenlm.ai, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  zai: {
    name: 'Zhipu GLM',
    url: 'https://chat.z.ai',
    model: 'glm-4.5',
    fields: ['token'],
    consoleSnippet: `copy(localStorage.getItem('token') || document.cookie)`,
    instruction: 'Open https://chat.z.ai, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  internlm: {
    name: 'InternLM',
    url: 'https://internlm.intern-ai.org.cn',
    model: 'intern-s1',
    fields: ['token'],
    consoleSnippet: `copy(localStorage.getItem('token') || document.cookie)`,
    instruction: 'Open https://internlm.intern-ai.org.cn, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  mimo: {
    name: 'Xiaomi MiMo',
    url: 'https://agent.xiaomi.com',
    model: 'mimo-flash',
    fields: ['token'],
    consoleSnippet: `copy(localStorage.getItem('token') || document.cookie)`,
    instruction: 'Open https://agent.xiaomi.com, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  },
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    model: 'gpt-4o-mini',
    fields: ['accessToken'],
    consoleSnippet: `copy(document.cookie)`,
    instruction: 'Open https://chatgpt.com, login, press F12 -> Console, paste snippet, press Enter, then paste here.'
  }
};
