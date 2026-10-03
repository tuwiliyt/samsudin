# SAMSUDIN (Autonomous Coding Agent Harness)

**Samsudin** is an autonomous AI software engineering agent harness designed to turn free multi-provider models into autonomous coding agents.

It combines the battle-tested **Claude Code agentic loop architecture** (`Perceive -> Reason -> Act -> Observe -> Verify`) with **Hermes XML tool-calling resilience** and **OpenCode model-agnostic interoperability**.

---

## Key Features

1. **Interactive REPL & One-Off CLI (Like OpenCode / Claude Code)**:
   - Interactive shell for multi-turn conversational task execution.
   - Built-in slash commands (`/model`, `/models`, `/compact`, `/clear`, `/tools`, `/stats`, `/git`, `/diff`, `/yolo`, `/exit`).
2. **Deterministic 5-Phase Master Loop**:
   - Continuous perception, reasoning, tool execution, and verification cycles.
   - Self-correcting: inspects errors autonomously and refines its approach.
3. **Dual-Mode Resilient Tool Parser**:
   - Parses **Hermes XML Tags** (`<tool_call><name>...</name><arguments>...</arguments></tool_call>`), Markdown JSON blocks, and corrupted model outputs with regex fallbacks.
   - 99%+ execution accuracy on non-frontier and open-weights models (DeepSeek, Qwen 2.5, GLM-4, Hunyuan, Wenxin, InternLM, MiMo).
4. **3-Tier Context Compaction**:
   - Prunes old terminal outputs and file dumps across iterations to prevent context exhaustion.
   - Automatically injects persistent rules from `SAMSUDIN.md` or `AGENTS.md`.
5. **Comprehensive Developer Tools**:
   - `bash`: Shell execution with timeout and output truncation.
   - `view_file`: Paginated line inspection.
   - `write_file`: File creation with directory scaffolding.
   - `replace_file_content`: Precise contiguous block replacement.
   - `grep`: Regex pattern search across the workspace.
   - `glob`: Rapid file path and pattern discovery.
   - `git_status` & `git_diff`: Workspace change inspection.
6. **Multi-Provider Engine Integration**:
   - Plugs directly into `ai-free` OpenAI-compatible endpoint (`http://127.0.0.1:4318/v1`) or any standard OpenAI API.
   - Supports 10+ free frontier models: DeepSeek-V3, ERNIE-5.1 (Wenxin), Hunyuan 4, GLM-4-Plus, Qwen 3 Max, Kimi, MiniMax, Xiaomi MiMo, InternLM, and ChatGPT.
7. **Session Persistence & Governance**:
   - Automatic session logging in `.samsudin/sessions/`.
   - Local/Global configuration in `.samsudin/config.json`.
   - Human-in-the-loop permission gate with dangerous bash command blocking.

---

## Architecture Overview

```
samsudin/
├── bin/
│   └── samsudin.mjs                # CLI executable (REPL & One-off mode)
├── src/
│   ├── index.mjs                   # Library programmatic entry point
│   ├── config/
│   │   └── config-manager.mjs      # Configuration manager (.samsudin/config.json)
│   ├── harness/
│   │   ├── agent-loop.mjs          # Master agent loop
│   │   ├── repl.mjs                # Interactive REPL shell & slash commands
│   │   ├── session-manager.mjs     # Session recording & transcript persistence
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
│   │   ├── glob.mjs                # File discovery
│   │   └── git-tools.mjs           # Git status & diff inspection
│   ├── providers/
│   │   ├── base-provider.mjs       # Abstract provider interface
│   │   ├── openai-provider.mjs     # OpenAI-compatible HTTP SSE provider
│   │   └── aifree-direct.mjs       # AI-Free bridge
│   ├── prompts/
│   │   └── system.mjs              # System prompt builder
│   └── utils/
│       └── terminal-ui.mjs         # Terminal banners and progress visualizer
├── test/                           # 13 unit tests (100% pass)
├── website/                        # Official Landing Page
├── SAMSUDIN.md                     # Agent workspace rules
└── package.json
```

---

## Quick Start & Usage

### 1. Interactive REPL Mode (Like Claude Code / OpenCode)
Simply run without arguments:
```bash
samsudin
```
Inside the REPL:
```
samsudin (intern-s1) > /help
samsudin (intern-s1) > /model k1.5
samsudin (k1.5) > Inspect all failing tests and suggest a patch
samsudin (k1.5) > /diff
samsudin (k1.5) > /stats
```

### 2. Autonomous One-Off Task
```bash
# Run task autonomously with YOLO mode
samsudin --yolo "Audit package.json, run tests, and fix any broken scripts"

# Run with a specific model
samsudin --model intern-s1 "Refactor database query logic in src/db.mjs"
samsudin --model ERINE-5.1 "Analyze project architecture and generate documentation"
```

### 3. REPL Slash Commands
| Command | Description |
| :--- | :--- |
| `/model <name>` | Switch active model on the fly without exiting session |
| `/models` | List all available models from connected backend |
| `/clear` | Clear message history and start a fresh session |
| `/compact` | Force context compaction manually |
| `/tools` | List registered tools and parameter schemas |
| `/yolo` | Toggle auto-approval of tool execution on/off |
| `/stats` | View session metrics, tool calls breakdown, and logs |
| `/git` | Inspect git branch and modified files |
| `/diff` | View uncommitted git diff in the workspace |
| `/exit` | Gracefully save and exit REPL session |

---

## Testing

Run the built-in Node test suite:
```bash
npm test
```
All 13 unit tests run with zero external test dependencies (`node:test` and `node:assert/strict`).

---

## License
MIT
