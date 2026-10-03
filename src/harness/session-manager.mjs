import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Session Manager for recording and persisting Samsudin agent sessions.
 */
export class SessionManager {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.sessionsDir = path.resolve(cwd, '.samsudin', 'sessions');
    this.sessionId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.sessionFile = path.resolve(this.sessionsDir, `${this.sessionId}.json`);
    this.stats = {
      startTime: new Date().toISOString(),
      turns: 0,
      toolCallsCount: 0,
      toolsUsed: {},
      modelUsed: null
    };
    this.history = [];
  }

  ensureDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  recordTurn(userPrompt, assistantResponse, toolCalls = []) {
    this.stats.turns++;
    this.stats.toolCallsCount += toolCalls.length;
    for (const call of toolCalls) {
      const name = call.name || 'unknown';
      this.stats.toolsUsed[name] = (this.stats.toolsUsed[name] || 0) + 1;
    }

    this.history.push({
      turn: this.stats.turns,
      timestamp: new Date().toISOString(),
      userPrompt,
      assistantResponse,
      toolCalls
    });

    this.save();
  }

  save() {
    try {
      this.ensureDir();
      const payload = {
        sessionId: this.sessionId,
        cwd: this.cwd,
        stats: this.stats,
        history: this.history
      };
      fs.writeFileSync(this.sessionFile, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {}
  }

  getStatsSummary() {
    return {
      sessionId: this.sessionId,
      turns: this.stats.turns,
      toolCallsCount: this.stats.toolCallsCount,
      toolsUsed: this.stats.toolsUsed,
      sessionFile: this.sessionFile
    };
  }
}
