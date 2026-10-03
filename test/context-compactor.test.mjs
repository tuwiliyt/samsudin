import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextCompactor } from '../src/harness/context-compactor.mjs';

test('ContextCompactor - compacts older tool results to preserve context tokens', () => {
  const compactor = new ContextCompactor({ pruneAfterTurns: 2 });

  const messages = [
    { role: 'system', content: 'You are Samsudin.' },
    { role: 'user', content: 'Run command' },
    // Turn 1: 4 turns ago -> should be compacted
    { role: 'user', content: '=== TOOL RESULT: bash ===\nLine 1\nLine 2\nLine 3\nLine 4\n' + 'x'.repeat(600) },
    { role: 'assistant', content: 'I see results' },
    { role: 'user', content: 'Next' },
    { role: 'assistant', content: 'Done' }
  ];

  const compacted = compactor.compactMessages(messages);
  assert.equal(compacted.length, messages.length);
  assert.ok(compacted[2].content.includes('[Tool result compacted'));
});
