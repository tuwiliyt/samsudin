import { BaseProvider } from './base-provider.mjs';

/**
 * OpenAI-compatible HTTP client supporting streaming SSE.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(options = {}) {
    super(options);
    this.baseUrl = (options.baseUrl || 'http://127.0.0.1:4318/v1').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || 'dummy-key';
    this.timeoutMs = options.timeoutMs || 120000;
    this.lastUsage = null;
  }

  async generateCompletion(messages, options = {}) {
    let fullText = '';
    for await (const chunk of this.streamCompletion(messages, options)) {
      fullText += chunk;
    }
    return {
      text: fullText,
      finishReason: 'stop',
      usage: this.lastUsage
    };
  }

  async *streamCompletion(messages, options = {}) {
    this.lastUsage = null;
    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: options.model || this.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: options.temperature ?? 0.2
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenAI API error [${response.status}]: ${errorText || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.usage) {
                this.lastUsage = data.usage;
              }
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                yield delta;
              }
            } catch {
              // ignore parse errors on malformed chunks
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Robust token estimator for prompt and completion messages.
 * Uses average character-to-token ratio (~3.8 chars/token for code & natural languages).
 */
export function estimateTokens(text = '') {
  if (!text) return 0;
  if (typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  return Math.ceil(text.length / 3.8);
}
