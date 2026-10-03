import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Configuration manager for Samsudin harness.
 * Checks local project config (.samsudin/config.json) first, then global (~/.samsudin/config.json).
 */
export class ConfigManager {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.localConfigPath = path.resolve(cwd, '.samsudin', 'config.json');
    this.globalConfigPath = path.resolve(os.homedir(), '.samsudin', 'config.json');
  }

  loadConfig() {
    const defaults = {
      defaultModel: 'ERINE-5.1',
      apiUrl: 'http://127.0.0.1:4318/v1',
      apiKey: 'dummy-key',
      yolo: false,
      maxSteps: 25,
      saveSessions: true
    };

    let globalConfig = {};
    if (fs.existsSync(this.globalConfigPath)) {
      try {
        globalConfig = JSON.parse(fs.readFileSync(this.globalConfigPath, 'utf-8'));
      } catch {}
    }

    let localConfig = {};
    if (fs.existsSync(this.localConfigPath)) {
      try {
        localConfig = JSON.parse(fs.readFileSync(this.localConfigPath, 'utf-8'));
      } catch {}
    }

    return {
      ...defaults,
      ...globalConfig,
      ...localConfig
    };
  }

  saveLocalConfig(updates = {}) {
    const current = this.loadConfig();
    const merged = { ...current, ...updates };
    const dir = path.dirname(this.localConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.localConfigPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }
}
