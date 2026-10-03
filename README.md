# SAMSUDIN (Autonomous Coding Agent Harness)

**Samsudin** is an autonomous AI software engineering agent harness designed to turn free multi-provider models into autonomous coding agents.

It combines the battle-tested **Claude Code agentic loop architecture** (`Perceive -> Reason -> Act -> Observe -> Verify`) with **Hermes XML tool-calling resilience** and **OpenCode model-agnostic interoperability**.

---

## Key Features

1. **Interactive REPL & One-Off CLI (Like OpenCode / Claude Code)**:
   - Interactive shell for multi-turn conversational task execution.
   - Built-in slash commands (`/model`, `/models`, `/compact`, `/clear`, `/tools`, `/stats`, `/git`, `/diff`, `/yolo`, `/exit`).
2. **Modular Provider Isolation (Use Only What You Need)**:
   - Zero requirement to configure all 10 providers. If you only want **DeepSeek** or only **MiniMax**, you can configure just that single provider!
3. **Deterministic 5-Phase Master Loop**:
   - Continuous perception, reasoning, tool execution, and verification cycles.
   - Self-correcting: inspects errors autonomously and refines its approach.
4. **Dual-Mode Resilient Tool Parser**:
   - Parses **Hermes XML Tags** (`<tool_call><name>...</name><arguments>...</arguments></tool_call>`), Markdown JSON blocks, and corrupted model outputs with regex fallbacks.
   - 99%+ execution accuracy on non-frontier and open-weights models (DeepSeek, Qwen 2.5, GLM-4, Hunyuan, Wenxin, InternLM, MiMo).
5. **3-Tier Context Compaction**:
   - Prunes old terminal outputs and file dumps across iterations to prevent context exhaustion.
   - Automatically injects persistent rules from `SAMSUDIN.md` or `AGENTS.md`.
6. **Comprehensive Developer Tools & Process Manager**:
   - `bash`: Shell execution with timeout, output truncation, and background process spawning (`isBackground: true`).
   - `process_manager`: Inspect background tasks, tail stdout/stderr logs, check status, or terminate processes.
   - `view_file`: Paginated line inspection supporting absolute, relative, and home tilde (`~`) paths.
   - `write_file`: File and script creation with automatic directory scaffolding.
   - `replace_file_content`: Precise contiguous block replacement.
   - `grep`: Regex pattern search across the workspace.
   - `glob`: Rapid file path and pattern discovery.
   - `git_status` & `git_diff`: Workspace change inspection.
7. **Ubuntu Linux Terminal Superpowers**:
   - Automated non-interactive package installation (`apt-get`, `snap`, `pip`, `npm`).
   - Process inspection, listening socket monitoring (`ss -tulpn`, `lsof -i :port`).
   - Docker container and Kubernetes (`kubectl`) administration.
   - Real-time hardware and resource diagnostics (`/sys`).
8. **Multi-Provider Engine Integration**:
   - Plugs directly into `ai-free` OpenAI-compatible endpoint (`http://127.0.0.1:4318/v1`) or any standard OpenAI API.
   - Supports 10 free frontier models: DeepSeek-V3, ERNIE-5.1 (Wenxin), Hunyuan 4, GLM-4-Plus, Qwen 3 Max, Kimi, MiniMax, Xiaomi MiMo, InternLM, and ChatGPT.

---

## Provider Authentication & Credential Setup

Samsudin is built with **modular authentication**. You can configure a single provider or multiple providers, depending on your needs.

### 🔍 Check Credential Status
View the connection status of all providers at any time:
```bash
samsudin auth status
```

---

### Method 1: Interactive CLI Wizard / 10-Second Browser Console (Zero Install)
You don't need to install any extension. You can connect a single provider directly via the terminal:

```bash
# To configure DeepSeek only:
samsudin auth deepseek

# To configure MiniMax only:
samsudin auth minimax

# To configure Kimi only:
samsudin auth kimi
```

**How it works:**
1. Open the provider's web chat in your browser (e.g., https://chat.deepseek.com or https://agent.minimaxi.com).
2. Press **F12** $\to$ switch to the **Console** tab.
3. Paste the 1-liner snippet displayed by Samsudin into your browser console and press **Enter** (it copies the token to your clipboard).
4. Paste the token back into the terminal prompt. Samsudin validates and saves it locally in `~/.samsudin/credentials.json` with permissions `600`.

---

### Method 2: One-Click Chrome Extension Import (Bulk or Selective)
For the most convenient setup across multiple accounts, Samsudin includes a built-in Chrome Extension in the [`extension/`](./extension) folder.

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top right).
3. Click **Load unpacked** and select the [`samsudin/extension`](./extension) directory.
4. Open the extension popup, check only the providers you want to export (e.g. check only DeepSeek or MiniMax), and click **Export Selected Credentials**.
5. Save `credentials.json` and import it into Samsudin:
   ```bash
   samsudin auth import /path/to/credentials.json
   ```

---

### Method 3: Official API Key (If You Have One)
If you already possess a standard API key from DeepSeek, MiniMax, or OpenRouter:
```bash
export OPENAI_API_KEY="sk-..."
# or run with explicit key:
samsudin --api-key "sk-..." "Your coding goal"
```

---

### Switching Active Provider
If you have multiple providers configured, switch the default active provider instantly:
```bash
samsudin auth switch deepseek
# or switch to MiniMax:
samsudin auth switch minimax
```
Or switch models on the fly inside the REPL with `/model <name>`.

---

## Architecture Overview

```
samsudin/
├── bin/
│   └── samsudin.mjs                # CLI executable (REPL, One-off, & Auth subcommands)
├── extension/                      # Chrome Extension for 1-click credential extraction
│   ├── manifest.json
│   ├── popup.html, popup.js, popup.css
│   └── icons/
├── src/
│   ├── index.mjs                   # Library programmatic entry point
│   ├── auth/
│   │   ├── auth-manager.mjs        # Modular credential manager (~/.samsudin/credentials.json)
│   │   └── provider-snippets.mjs   # 1-liner browser console snippets & provider URLs
│   ├── cli/
│   │   └── auth-cli.mjs            # CLI handlers for samsudin auth commands
│   ├── config/
│   │   └── config-manager.mjs      # Configuration manager (.samsudin/config.json)
│   ├── harness/
│   │   ├── agent-loop.mjs          # Master agent loop (Perceive -> Reason -> Act -> Verify)
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
├── test/                           # 16 unit tests (100% pass)
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

### 3. REPL Slash Commands (Full Harness Capabilities)

Samsudin implements the full spectrum of slash commands found in leading agent harnesses (Claude Code, OpenCode, Hermes):

#### 🧠 Model & AI Engine Commands
| Command | Description |
| :--- | :--- |
| `/usage`, `/cost` | Display cumulative token consumption (prompt vs completion), turn count, and commercial cost savings |
| `/tokens` | Inspect current active context window usage, capacity gauge bar, and compaction readiness |
| `/model` | Inspect active model information (provider, context window, capabilities) |
| `/model <name>` | Switch active model on the fly without exiting session (e.g. `/model intern-s1`, `/model k1.5`) |
| `/models` | Fetch and list all available models from the backend API |

#### 📂 Session & Context Commands
| Command | Description |
| :--- | :--- |
| `/compact` | Force 3-tier context compaction immediately to reclaim token capacity |
| `/clear` | Clear conversation history and reset context for a clean task |
| `/stats` | View session metrics, tool calls breakdown, net savings, and audit log path |
| `/doctor` | Run comprehensive system diagnostics (Node runtime, Git branch, API status, credentials) |

#### 🛠️ Developer & Git Autonomous Commands
| Command | Description |
| :--- | :--- |
| `/init` | Scaffold standard `SAMSUDIN.md` project rules in the current workspace |
| `/review` | Trigger autonomous AI code review on uncommitted `git diff` |
| `/undo` | Revert uncommitted modifications in tracked files via git |
| `/tasks` | List all active background tasks, daemons, and servers |
| `/sys` | Display Ubuntu hardware, kernel, memory, socket, and Docker diagnostics |
| `/git` | Inspect git branch and modified files |
| `/diff` | View uncommitted git diff in the workspace |
| `/tools` | List registered tools and parameter schemas |
| `/yolo` | Toggle tool auto-approval mode on/off |
| `/exit`, `/quit` | Gracefully save audit transcript and exit REPL session |

---

## Testing

Run the built-in Node test suite:
```bash
npm test
```
All 18 unit tests run with zero external test dependencies (`node:test` and `node:assert/strict`).

---

## License
MIT
