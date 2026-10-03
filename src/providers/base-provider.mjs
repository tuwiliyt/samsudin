/**
 * Base abstract class for LLM providers in Samsudin.
 */
export class BaseProvider {
  constructor(options = {}) {
    this.model = options.model || 'deepseek-chat';
    this.name = options.name || 'base';
  }

  /**
   * Generates a completion for the given messages.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   * @returns {Promise<{text: string, finishReason: string}>}
   */
  async generateCompletion(messages, options = {}) {
    throw new Error('generateCompletion() must be implemented by subclass.');
  }

  /**
   * Streams completion tokens.
   */
  async *streamCompletion(messages, options = {}) {
    throw new Error('streamCompletion() must be implemented by subclass.');
  }
}
