import fs from 'node:fs';
import path from 'node:path';

/**
 * 3-Tier Context Compaction & Sliding Window Manager
 * Inspired by Claude Code context architecture.
 */
export class ContextCompactor {
  constructor(options = {}) {
    this.maxContextTokensApprox = options.maxContextTokensApprox || 32000;
    this.maxToolResultBytes = options.maxToolResultBytes || 12000; // Limit per tool result in recent history
    this.pruneAfterTurns = options.pruneAfterTurns || 3; // After N turns, collapse tool output
    this.projectInstructionFiles = options.projectInstructionFiles || ['SAMSUDIN.md', 'AGENTS.md', 'CLAUDE.md'];
  }

  /**
   * Loads project instructions from root files if present.
   */
  loadProjectInstructions(cwd = process.cwd()) {
    for (const filename of this.projectInstructionFiles) {
      const fullPath = path.resolve(cwd, filename);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8').trim();
          if (content) {
            return {
              file: filename,
              content
            };
          }
        } catch {
          // ignore unreadable file
        }
      }
    }
    return null;
  }

  /**
   * Compacts conversation history before sending to the model:
   * 1. Preserves system prompt.
   * 2. Collapses old tool execution results (> pruneAfterTurns ago).
   * 3. Truncates overly large tool results in active turns.
   */
  compactMessages(messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const total = messages.length;
    return messages.map((msg, index) => {
      // Don't touch system or standard user messages
      if (msg.role !== 'tool' && !msg.content?.includes?.('=== TOOL RESULT')) {
        return msg;
      }

      const turnsAgo = total - 1 - index;
      let content = msg.content || '';

      // Tier 1: Old tool output (> pruneAfterTurns ago) -> collapse to high-level summary
      if (turnsAgo > this.pruneAfterTurns && content.length > 500) {
        const firstFewLines = content.split('\n').slice(0, 4).join('\n');
        return {
          ...msg,
          content: `${firstFewLines}\n... [Tool result compacted (${content.length} chars) to preserve context]`
        };
      }

      // Tier 2: Recent tool output that is excessively long -> truncate tail
      if (content.length > this.maxToolResultBytes) {
        const head = content.slice(0, this.maxToolResultBytes);
        return {
          ...msg,
          content: `${head}\n... [Output truncated: ${content.length - this.maxToolResultBytes} bytes omitted]`
        };
      }

      return msg;
    });
  }

  /**
   * Rough token estimation (approx 4 chars per token for English/code, 1.5 for CJK)
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 3);
  }
}
