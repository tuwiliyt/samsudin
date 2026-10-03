import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentLoop } from '../src/harness/agent-loop.mjs';
import { BaseProvider } from '../src/providers/base-provider.mjs';

class MockAgentProvider extends BaseProvider {
  constructor() {
    super({ model: 'mock-model' });
    this.turn = 0;
  }

  async *streamCompletion(messages) {
    this.turn++;
    if (this.turn === 1) {
      yield 'I will execute an echo command to verify the shell.\n';
      yield '<tool_call>\n<name>bash</name>\n<arguments>{"command": "echo \\"samsudin test\\""}</arguments>\n</tool_call>';
    } else {
      yield 'The command succeeded. I have verified everything and completed the task successfully.';
    }
  }

  async generateCompletion(messages) {
    let full = '';
    for await (const chunk of this.streamCompletion(messages)) {
      full += chunk;
    }
    return { text: full, finishReason: 'stop' };
  }
}

test('AgentLoop - orchestrates multi-step agent execution with tools', async () => {
  const mockProvider = new MockAgentProvider();
  const events = [];

  const agent = new AgentLoop({
    provider: mockProvider,
    cwd: process.cwd(),
    yolo: true,
    maxSteps: 5,
    onEvent: (ev) => events.push(ev.type)
  });

  const result = await agent.runTask('Verify echo test');

  assert.equal(result.success, true);
  assert.equal(result.stepsTaken, 2);
  assert.ok(result.finalAnswer.includes('completed the task successfully'));
  assert.ok(events.includes('tool:call'));
  assert.ok(events.includes('tool:result'));
  assert.ok(events.includes('task:complete'));
});
