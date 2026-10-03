import { AgentLoop } from './agent-loop.mjs';
import { PermissionGate } from './permissions.mjs';

/**
 * Architect / Editor workflow (inspired by Aider's architect mode).
 *
 * Phase 1 - Architect: a (typically stronger-reasoning) model explores the repo in READ-ONLY plan
 *           mode and writes a concrete implementation plan.
 * Phase 2 - Editor:    a (typically faster / better tool-calling) model implements that plan
 *           with the normal permission gate and tools.
 *
 * The user chooses BOTH models; Samsudin never picks them.
 */
export async function runArchitectEditor({
  goal,
  architectProvider,
  editorProvider,
  cwd = process.cwd(),
  maxSteps = 25,
  compactor,
  editorGate,
  checkpointManager = null,
  history = [],
  onEvent = () => {}
}) {
  if (!goal) throw new Error('goal is required.');
  if (!architectProvider || !editorProvider) {
    throw new Error('Both architectProvider and editorProvider are required.');
  }

  // ---- Phase 1: Architect (read-only) ----
  onEvent({
    type: 'phase:start',
    data: { phase: 'architect', model: architectProvider.model },
    timestamp: new Date().toISOString()
  });

  const architect = new AgentLoop({
    provider: architectProvider,
    cwd,
    maxSteps: Math.min(maxSteps, 15),
    compactor,
    permissionGate: new PermissionGate({ planMode: true, cwd }),
    onEvent
  });
  const architectResult = await architect.runTask(goal, { history });
  const plan = (architectResult.finalAnswer || '').trim();

  // ---- Phase 2: Editor (executes plan) ----
  onEvent({
    type: 'phase:start',
    data: { phase: 'editor', model: editorProvider.model, hasPlan: Boolean(plan) },
    timestamp: new Date().toISOString()
  });

  const editorGoal = plan && architectResult.stopReason === 'complete'
    ? `${goal}\n\n## Implementation plan from the architect model (follow it, adapt only if reality differs, and verify when done):\n${plan}`
    : goal;

  const editor = new AgentLoop({
    provider: editorProvider,
    cwd,
    maxSteps,
    compactor,
    permissionGate: editorGate || new PermissionGate({ cwd }),
    checkpointManager,
    onEvent
  });
  const editorResult = await editor.runTask(editorGoal, { history, displayGoal: goal });

  const usage = {
    promptTokens: architectResult.usage.promptTokens + editorResult.usage.promptTokens,
    completionTokens: architectResult.usage.completionTokens + editorResult.usage.completionTokens,
    totalTokens: architectResult.usage.totalTokens + editorResult.usage.totalTokens
  };

  return { ...editorResult, plan, architectResult, usage };
}
