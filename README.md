# SAMSUDIN (Autonomous Coding Agent Harness)

**Samsudin** is an autonomous AI software engineering agent harness designed to turn free multi-provider models into autonomous coding agents.

It combines the battle-tested **Claude Code agentic loop architecture** (`Perceive -> Reason -> Act -> Observe -> Verify`) with the **Hermes XML tool-calling resilience** and **OpenCode model-agnostic interoperability**.

---

## Key Features

1. **Deterministic 5-Phase Master Loop**:
   - Continuous perception, reasoning, tool execution, and verification cycles.
   - Self-correcting: inspects errors autonomously and refines its approach.
2. **Dual-Mode Resilient Tool Parser**:
   - Parses **Hermes XML Tags** (`<tool_call><name>...</name><arguments>...</arguments></tool_call>`) and Markdown JSON blocks.
   - 99%+ execution accuracy on non-frontier and open-weights models (DeepSeek, Qwen 2.5, GLM-4, Hunyuan, Wenxin).
3. **3-Tier Context Compaction**:
   - Prunes old terminal outputs and file contents across iterations.
   - Automatically injects persistent rules from `SAMSUDIN.md` or `AGENTS.md`.
4. **Production Developer Tools**:
   - `bash`: Shell execution with timeout and output truncation.
   - `view_file`: Paginated line inspection.
   - `write_file`: File creation with directory scaffolding.
   - `replace_file_content`: Precise contiguous block replacement.
   - `grep`: Regex pattern search across the workspace.
   - `glob`: Rapid file path and pattern discovery.
5. **Multi-Provider Engine Integration**:
   - Plugs directly into `ai-free` OpenAI-compatible endpoint (`http://127.0.0.1:3000/v1`) or any standard OpenAI API.
   - Supports 10+ free frontier models: DeepSeek-V3, ERNIE-5.1 (Wenxin), Hunyuan 4, GLM-4-Plus, Qwen 3 Max, Kimi, MiniMax, Xiaomi MiMo, InternLM, and ChatGPT.

---

## Architecture Overview

```
samsudin/
├── bin/
│   └── samsudin.mjs                # CLI executable
├── src/
│   ├── index.mjs                   # Library entry point
│   ├── harness/
│   │   ├── agent-loop.mjs          # Master agent loop
│   │   ├── context-compactor.mjs   # 3-tier context management & sliding window
│   │   └── permissions.mjs         # Permission gate & security policy
│   ├── parser/
│   │   └── tool-call-parser.mjs    # Hermes XML + JSON dual parser
│   ├── tools/
│   │   ├── registry.mjs            # Tool catalog & dispatcher
│   │   ├── bash.mjs                # Terminal command execution
│   │   ├── view-file.mjs           # Paginated file reading
│   │   ├── write-file.mjs          # File creation
│   │   ├── replace-file.mjs        # Targeted text replacement
│   │   ├── grep.mjs                # Fast regex search
│   │   └── glob.mjs                # File discovery
│   ├── providers/
│   │   ├── base-provider.mjs       # Abstract provider interface
│   │   ├── openai-provider.mjs     # OpenAI-compatible HTTP SSE provider
│   │   └── aifree-direct.mjs       # AI-Free bridge
│   ├── prompts/
│   │   └── system.mjs              # System prompt builder
│   └── utils/
│       └── terminal-ui.mjs         # Terminal banners and progress visualizer
├── test/                           # Full unit test suite
├── SAMSUDIN.md                     # Agent workspace rules
└── package.json
```

---

## Installation & Quick Start

### 1. Standalone / Global Link
```bash
cd /content/samsudin
npm link
```

### 2. Run with AI-Free Local Server
Ensure your `ai-free` server is running (e.g. `node /content/ai-free/bin/deepseek.mjs --api`):
```bash
# Run task autonomously
samsudin --yolo "Audit package.json, run tests, and fix any broken scripts"

# Run with specific model
samsudin --model ERINE-5.1 "Refactor database query logic in src/db.mjs"

# Run with Hunyuan
samsudin --model hy4-preview-g "Analyze project architecture and generate documentation"
```

### 3. CLI Flags
* `-m, --model <name>`: Model identifier (e.g., `deepseek-chat`, `ERINE-5.1`, `hy4-preview-g`, `qwen3-max`).
* `-u, --api-url <url>`: API endpoint (default: `http://127.0.0.1:3000/v1`).
* `-y, --yolo`: Auto-approve all tool operations without prompting.
* `-v, --verbose`: Show full streaming tokens and raw parameters.
* `-s, --steps <N>`: Maximum iterations before loop exits (default: `25`).
* `-h, --help`: Display help and options.

---

## Testing

Run the built-in Node test suite:
```bash
npm test
```
All tests are implemented using standard Node.js test runner (`node:test` and `node:assert/strict`) with zero external test dependencies.

---

## License
MIT
