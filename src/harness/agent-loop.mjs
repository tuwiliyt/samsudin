import { ContextCompactor } from './context-compactor.mjs';
import { PermissionGate } from './permissions.mjs';
import { parseToolCallsFromText } from '../parser/tool-call-parser.mjs';
import { dispatchToolCall } from '../tools/registry.mjs';
import { buildSystemPrompt } from '../prompts/system.mjs';
import { estimateTokens } from '../providers/openai-provider.mjs';
import { StuckDetector } from './stuck-detector.mjs';
import { resolveWorkspacePath } from '../utils/path-resolver.mjs';

const FILE_MUTATING_TOOLS = new Set(['write_file', 'replace_file_content']);

/**
 * Samsudin Master Agent Loop
 * Implements Claude Code perceive-reason-act-verify cycle with Hermes tool resilience.
 */
export class AgentLoop {
  constructor(options = {}) {
    this.provider = options.provider;
    if (!this.provider) {
      throw new Error('A valid LLM provider instance must be provided to AgentLoop.');
    }

    this.cwd = options.cwd || process.cwd();
    this.maxSteps = options.maxSteps || 25;
    this.compactor = options.compactor || new ContextCompactor();
    this.permissionGate = options.permissionGate || new PermissionGate({ yolo: options.yolo, cwd: this.cwd });
    this.checkpointManager = options.checkpointManager || null;
    this.stuckDetector = options.stuckDetector || new StuckDetector();
    this.onEvent = options.onEvent || (() => {});
  }

  /**
   * Run the autonomous task loop.
   * @param {string} userGoal
   * @param {object} [opts]
   * @param {Array}  [opts.history]     Prior conversation messages (system messages are dropped) for multi-turn REPL use.
   * @param {string} [opts.displayGoal] Short goal text used in continuation notes (defaults to userGoal).
   */
  async runTask(userGoal, opts = {}) {
    if (!userGoal || typeof userGoal !== 'string') {
      throw new Error('userGoal must be a non-empty string.');
    }

    const planMode = Boolean(this.permissionGate.planMode);
    const goalLabel = opts.displayGoal || userGoal;

    this.emit('task:start', { goal: goalLabel, cwd: this.cwd, mode: planMode ? 'plan' : 'act' });

    // Step 1: Perceive environment & project instructions
    const projectInstructions = this.compactor.loadProjectInstructions(this.cwd);
    const systemPrompt = buildSystemPrompt({
      projectInstructions,
      workspaceDir: this.cwd,
      planMode
    });

    const priorMessages = Array.isArray(opts.history)
      ? opts.history.filter(m => m && m.role !== 'system')
      : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...priorMessages,
      { role: 'user', content: userGoal }
    ];

    // One checkpoint per user turn (lazy: only materialized if a file is actually modified)
    if (this.checkpointManager) {
      this.checkpointManager.begin(goalLabel);
    }
    this.stuckDetector.reset();
    let stuckWarnings = 0;
    let stopReason = 'complete';


    let step = 0;
    let finalAnswer = '';
    const totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };

    while (step < this.maxSteps) {
      step++;
      this.emit('step:start', { step, maxSteps: this.maxSteps });

      // Step 2: Compact context before sending to model
      const compactedMessages = this.compactor.compactMessages(messages);

      // Step 3: Stream / generate completion from LLM
      let assistantText = '';
      this.emit('generation:start', { step });

      try {
        for await (const chunk of this.provider.streamCompletion(compactedMessages)) {
          assistantText += chunk;
          this.emit('token', { chunk, step });
        }
      } catch (err) {
        // Fallback to non-streaming if streaming fails
        try {
          const res = await this.provider.generateCompletion(compactedMessages);
          assistantText = res.text || '';
        } catch (innerErr) {
          this.emit('error', { step, error: innerErr.message });
          throw new Error(`Failed to generate response at step ${step}: ${innerErr.message}`);
        }
      }

      this.emit('generation:end', { step, fullText: assistantText });

      // Calculate token consumption for this step
      const stepPromptTokens = this.provider.lastUsage?.prompt_tokens ?? estimateTokens(compactedMessages);
      const stepCompletionTokens = this.provider.lastUsage?.completion_tokens ?? estimateTokens(assistantText);
      totalUsage.promptTokens += stepPromptTokens;
      totalUsage.completionTokens += stepCompletionTokens;
      totalUsage.totalTokens += (stepPromptTokens + stepCompletionTokens);

      this.emit('tokens', {
        step,
        stepPromptTokens,
        stepCompletionTokens,
        totalUsage: { ...totalUsage }
      });

      if (assistantText.startsWith('[Error]') || assistantText.includes('API error HTTP')) {
        this.emit('error', { step, error: assistantText.trim() });
        throw new Error(`Model API error at step ${step}: ${assistantText.trim()}`);
      }

      // Step 4: Parse tool calls
      const parsed = parseToolCallsFromText(assistantText);
      messages.push({
        role: 'assistant',
        content: assistantText
      });

      // If no tool calls, the agent has finished its task
      if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
        finalAnswer = parsed.thinking || assistantText;
        this.emit('task:complete', { step, finalAnswer, mode: planMode ? 'plan' : 'act' });
        break;
      }

      // Step 5: Execute tool calls sequentially
      for (const call of parsed.toolCalls) {
        const { name, arguments: toolArgs } = call;
        this.emit('tool:call', { name, args: toolArgs, step });

        // Check permission gate
        const perm = await this.permissionGate.checkPermission(name, toolArgs);
        if (!perm.allowed) {
          const rejectionNotice = `[TOOL REJECTED] Execution of '${name}' was not permitted: ${perm.reason}`;
          this.emit('tool:rejected', { name, reason: perm.reason });
          messages.push({
            role: 'user',
            content: `=== TOOL RESULT: ${name} ===\nStatus: Error\n${rejectionNotice}`
          });
          this.stuckDetector.record({ name, args: toolArgs, observation: rejectionNotice, isError: true });
          continue;
        }

        // Snapshot file state before any file-mutating tool runs
        if (this.checkpointManager && FILE_MUTATING_TOOLS.has(name) && toolArgs?.filePath) {
          try {
            const created = this.checkpointManager.trackFile(resolveWorkspacePath(toolArgs.filePath, this.cwd));
            if (created) this.emit('checkpoint:tracked', { file: toolArgs.filePath });
          } catch {
            // Never let checkpointing break the agent
          }
        }

        // Execute tool
        try {
          this.emit('tool:executing', { name, args: toolArgs });
          const result = await dispatchToolCall(name, toolArgs, { cwd: this.cwd });
          this.emit('tool:result', { name, result });

          const formattedResult = this.formatToolResult(name, result);
          messages.push({
            role: 'user',
            content: `=== TOOL RESULT: ${name} ===\n${formattedResult}\n\n[System Note: Continue working autonomously towards the target goal: "${goalLabel}". If additional steps/tools are needed, output the next <tool_call>. Only when the entire goal is completed and verified, summarize your work without further tool calls.]`
          });
          this.stuckDetector.record({
            name,
            args: toolArgs,
            observation: formattedResult,
            isError: result && typeof result === 'object' && result.success === false
          });
        } catch (toolErr) {
          this.emit('tool:error', { name, error: toolErr.message });
          messages.push({
            role: 'user',
            content: `=== TOOL RESULT: ${name} ===\nStatus: Exception\nError: ${toolErr.message}\n\n[System Note: Inspect the error and continue autonomously working towards the goal: "${goalLabel}".]`
          });
          this.stuckDetector.record({ name, args: toolArgs, observation: toolErr.message, isError: true });
        }
      }

      // Step 6: Stuck detection - warn once, then abort if the loop persists
      const stuck = this.stuckDetector.check();
      if (stuck.stuck) {
        stuckWarnings++;
        if (stuckWarnings === 1) {
          this.emit('stuck:warning', { step, ...stuck });
          messages.push({
            role: 'user',
            content: `[System Warning] You appear to be stuck in a loop: ${stuck.reason}. Repeating the same action will not change the outcome. Stop and re-think: re-read the relevant error/output, try a DIFFERENT approach (different command, arguments, or file), or if the goal is already complete or impossible, give a final summary without further tool calls.`
          });
          this.stuckDetector.reset();
        } else {
          this.emit('stuck:abort', { step, ...stuck });
          stopReason = 'stuck';
          finalAnswer = `Stopped: the agent kept looping after a warning (${stuck.reason}). Try rephrasing the goal, switching model (/model), or using /plan first.`;
          break;
        }
      }
    }

    if (step >= this.maxSteps && !finalAnswer) {
      this.emit('task:max_steps_reached', { maxSteps: this.maxSteps });
      finalAnswer = 'Reached maximum iteration limit before final completion.';
      stopReason = 'max_steps';
    }

    return {
      success: stopReason !== 'stuck',
      stopReason,
      stepsTaken: step,
      finalAnswer,
      messages,
      usage: totalUsage
    };
  }

  formatToolResult(toolName, result) {
    if (typeof result === 'string') return result;

    if (toolName === 'bash') {
      if (result.isBackground) {
        return `[BACKGROUND PROCESS STARTED]\nTask ID: ${result.taskId}\nPID: ${result.pid}\nCommand: ${result.command}\nLog File: ${result.logFile}\nStatus: RUNNING\nNote: Use process_manager tool (action="logs" or action="status") to monitor this task.`;
      }
      return `Exit Code: ${result.exitCode}\nStdout:\n${result.stdout || '(no stdout)'}\nStderr:\n${result.stderr || '(no stderr)'}`;
    }

    if (toolName === 'process_manager') {
      if (result.logs !== undefined) {
        return `Task ID: ${result.taskId} (PID: ${result.pid}, Status: ${result.status})\nLogs (last ${result.linesShown} lines of ${result.totalLines}):\n${result.logs || '(empty)'}`;
      }
      return JSON.stringify(result, null, 2);
    }

    if (toolName === 'view_file') {
      return `File: ${result.filePath} (Lines ${result.startLine}-${result.endLine} of ${result.totalLines})\n\n${result.content}`;
    }

    if (toolName === 'replace_file_content') {
      return `File: ${result.filePath}\nStatus: Successfully replaced ${result.occurrencesReplaced} occurrence(s).`;
    }

    if (toolName === 'write_file') {
      return `File: ${result.filePath}\nStatus: Written ${result.bytesWritten} bytes (${result.linesCount} lines).`;
    }

    if (toolName === 'grep') {
      return `Pattern: ${result.pattern}\nMatches Found: ${result.totalMatches}\n${JSON.stringify(result.matches.slice(0, 50), null, 2)}`;
    }

    if (toolName === 'glob') {
      return `Pattern: ${result.pattern}\nTotal Files: ${result.totalFiles}\n${result.files.slice(0, 80).join('\n')}`;
    }

    return JSON.stringify(result, null, 2);
  }

  emit(eventType, data) {
    if (typeof this.onEvent === 'function') {
      this.onEvent({ type: eventType, data, timestamp: new Date().toISOString() });
    }
  }
}
