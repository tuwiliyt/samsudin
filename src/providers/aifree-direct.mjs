import path from 'node:path';
import fs from 'node:fs';
import { BaseProvider } from './base-provider.mjs';
import { OpenAIProvider } from './openai-provider.mjs';

/**
 * Direct or Proxy Provider to AI-Free Multi-Provider Engine.
 */
export class AiFreeProvider extends BaseProvider {
  constructor(options = {}) {
    super(options);
    this.aiFreePath = options.aiFreePath || process.env.AI_FREE_PATH || '/content/ai-free';
    this.apiUrl = options.apiUrl || process.env.AI_FREE_API_URL || 'http://127.0.0.1:4318/v1';
    this.httpProvider = new OpenAIProvider({
      baseUrl: this.apiUrl,
      model: this.model,
      timeoutMs: options.timeoutMs || 180000
    });
  }

  async generateCompletion(messages, options = {}) {
    // Standard delegate through OpenAI-compatible interface
    return await this.httpProvider.generateCompletion(messages, {
      ...options,
      model: options.model || this.model
    });
  }

  async *streamCompletion(messages, options = {}) {
    yield* this.httpProvider.streamCompletion(messages, {
      ...options,
      model: options.model || this.model
    });
  }
}
