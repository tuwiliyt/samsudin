import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PROVIDERS_META } from './provider-snippets.mjs';

/**
 * Modular Multi-Provider Authentication Manager for Samsudin.
 * Keeps providers isolated so users can run with just 1 provider (e.g. DeepSeek or MiniMax only).
 */
export class AuthManager {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.globalDir = path.resolve(os.homedir(), '.samsudin');
    this.credentialsFile = path.resolve(this.globalDir, 'credentials.json');
  }

  ensureDir() {
    if (!fs.existsSync(this.globalDir)) {
      fs.mkdirSync(this.globalDir, { recursive: true, mode: 0o700 });
    }
  }

  loadCredentials() {
    this.ensureDir();
    if (!fs.existsSync(this.credentialsFile)) {
      return { activeProvider: null, providers: {} };
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.credentialsFile, 'utf-8'));
      return {
        activeProvider: data.activeProvider || null,
        providers: data.providers || {}
      };
    } catch {
      return { activeProvider: null, providers: {} };
    }
  }

  saveCredentials(creds) {
    this.ensureDir();
    fs.writeFileSync(this.credentialsFile, JSON.stringify(creds, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    });
  }

  setProvider(providerName, data = {}) {
    const key = providerName.toLowerCase();
    if (!PROVIDERS_META[key]) {
      throw new Error(`Unknown provider: '${providerName}'. Valid: ${Object.keys(PROVIDERS_META).join(', ')}`);
    }

    const creds = this.loadCredentials();
    creds.providers[key] = {
      ...creds.providers[key],
      ...data,
      updatedAt: new Date().toISOString()
    };

    if (!creds.activeProvider) {
      creds.activeProvider = key;
    }

    this.saveCredentials(creds);
    this.syncToLegacyDir(key, creds.providers[key]);

    return {
      provider: key,
      meta: PROVIDERS_META[key],
      auth: creds.providers[key]
    };
  }

  setActiveProvider(providerName) {
    const key = providerName.toLowerCase();
    const creds = this.loadCredentials();
    if (!creds.providers[key]) {
      throw new Error(`Provider '${key}' is not configured yet. Run 'samsudin auth ${key}' first.`);
    }
    creds.activeProvider = key;
    this.saveCredentials(creds);
    return key;
  }

  importCredentialsFile(filePath) {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.cwd, filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Credentials file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    let imported;
    try {
      imported = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Failed to parse JSON file: ${e.message}`);
    }

    const creds = this.loadCredentials();
    let importedCount = 0;
    const importedKeys = [];

    // Format A: Chrome extension export with { providers: { deepseek: {...}, ... } }
    if (imported.providers && typeof imported.providers === 'object') {
      for (const [pName, pData] of Object.entries(imported.providers)) {
        const key = pName.toLowerCase();
        if (PROVIDERS_META[key] && pData) {
          creds.providers[key] = { ...pData, updatedAt: new Date().toISOString() };
          this.syncToLegacyDir(key, pData);
          importedKeys.push(key);
          importedCount++;
        }
      }
    }
    // Format B: Flat dictionary or single provider { deepseek: {...}, minimax: {...} }
    else if (typeof imported === 'object') {
      for (const [key, value] of Object.entries(imported)) {
        const normKey = key.replace(/^-cli$/, '').replace(/^\./, '').toLowerCase();
        if (PROVIDERS_META[normKey] && value) {
          creds.providers[normKey] = { ...value, updatedAt: new Date().toISOString() };
          this.syncToLegacyDir(normKey, value);
          importedKeys.push(normKey);
          importedCount++;
        }
      }
    }

    if (importedKeys.length > 0 && !creds.activeProvider) {
      creds.activeProvider = importedKeys[0];
    }

    this.saveCredentials(creds);

    return {
      importedCount,
      importedKeys,
      activeProvider: creds.activeProvider
    };
  }

  getStatus() {
    const creds = this.loadCredentials();
    const result = [];

    for (const [key, meta] of Object.entries(PROVIDERS_META)) {
      const auth = creds.providers[key];
      const isConfigured = Boolean(auth && (auth.token || auth.access_token || auth.cookies || auth.cookieHeader));
      const isActive = creds.activeProvider === key;

      result.push({
        id: key,
        name: meta.name,
        defaultModel: meta.model,
        isConfigured,
        isActive,
        updatedAt: auth?.updatedAt || null
      });
    }

    return {
      activeProvider: creds.activeProvider,
      credentialsFile: this.credentialsFile,
      providers: result
    };
  }

  /**
   * Syncs to legacy ~/.<provider>-cli/auth.json for backward compatibility with ai-free engine
   */
  syncToLegacyDir(providerKey, data) {
    try {
      const legacyDir = path.resolve(os.homedir(), `.${providerKey}-cli`);
      if (!fs.existsSync(legacyDir)) {
        fs.mkdirSync(legacyDir, { recursive: true, mode: 0o700 });
      }
      const authFile = path.resolve(legacyDir, 'auth.json');
      fs.writeFileSync(authFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    } catch {}
  }
}
