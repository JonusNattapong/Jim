# JimCode

<img src="assets/interface.png" alt="Jim Interface" width="640" />

JimCode is an open-source, terminal-based AI coding agent framework. It features a proactive learning loop inspired by Hermes, with **35+ built-in tools** for file manipulation, shell commands, web access, social media, office documents, and more. JimCode supports multiple LLM providers, dynamic tool loading via MCP, and structured workflows for planning and execution.

## Highlights

- `35+ built-in tools` plus dynamic MCP tools
- `Multi-model CLI` with searchable model and provider pickers
- `Provider selection` with favorites, recents, presets, and native provider setup modals
- `Work modes` for `architect`, `ask`, and `code`
- `Task board` via `todo_write` with blocked, dependencies, owners, notes, and acceptance criteria
- `AI-driven choice prompts` via `ask_user_choice`
- `Plan approval` guardrail before mutation tools run
- `Sub-agents` with planner/executor/reviewer support
- `Sessions + checkpoints` persisted under `~/.jim`
- `Hooks`, `memory`, `MCP`, and `plugin catalog`
- `User Persona Modeling` persisted under `.jim/user_persona.json`
- `Self-Improving Skill Store` persisted under `.jim/skills/`
- `Memory management` with archive, recall, list, and forget operations
- `Office document tools` for Word, Excel, and PowerPoint
- `Social media access` for YouTube, Twitter/X, and Reddit
- `Browser automation` for web interaction
- `TypeScript checking` with hover info and diagnostics
- `Knowledge graph` for codebase understanding
- `UI themes` for terminal customization
- `YOLO mode` for bypassing safety checks
- `Ollaman` background task support
- `Antigravity Browser` with premium HUD, visual ripples, and smooth scrolling
- `Pending Messages Queue` for asynchronous, non-blocking task discovery
- `Concurrent Messaging`: Send follow-up instructions while Jim is busy; they are automatically queued for the next turn.
- `Real-time Interrupts`: Use slash commands like `/stop`, `/queue`, or `/browser` even during long-running tasks.
- `Structured logging` with `pino`
- `Semantic repo map` powered by `ts-morph`
- `Provider metadata registry` for adapter capabilities, transport, and model recommendations
- `Bridge system` for remote control via WebSocket
- `Command system` with 20+ slash commands
- `Keybinding system` with chord support and hot reload
- `Desktop notifications` for alerts
- `Telemetry` for usage analytics
- `Diagnostics` for system health monitoring
- `Rate limiting` for API usage management
- `Voice integration` for accessibility
- `Vim mode` for editor integration
- `PowerShell support` for Windows users
- `Jupyter notebook editing` for data science workflows
- `MCP OAuth authentication` for enterprise use

## Quick Start

```bash
# install dependencies
npm install

# run in dev
npm run dev

# or build + run
npm run build
npm start
```

Required environment:

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o
```

Optional environment:

```bash
export OPENAI_BASE_URL=https://api.openai.com/v1
export API_MODE=auto
export PROVIDER_PRESET=openai
export MAX_TURNS=25
export MAX_TOOL_OUTPUT=5000
export PERMISSION_MODE=default
export BRAVE_SEARCH_API_KEY=...
export LOG_LEVEL=debug
```

## What Jim Can Do

### Core workflows

- Explore a repo with file reads, grep, project info, and semantic repo maps
- Create a task plan and require approval before edits/commands
- Ask the user to choose between 2-5 concrete options when there are tradeoffs
- Run shell commands, fetch web docs, and use MCP tools
- Spawn sub-agents for exploration or delegated work
- Save sessions and restore checkpoints from the terminal UI
- Query knowledge graph for codebase understanding
- Check TypeScript for errors and get hover information
- Remote control via bridge WebSocket server
- Desktop notifications for task completion alerts
- **Antigravity Browser Engine**: Real-time visual feedback with orange border HUD, interaction ripples, and smooth navigation.
- **Async Messaging Queue**: Decoupled task management allowing sub-agents to queue follow-ups without stopping.
- **Role-Based Intelligence**: Specialized protocols for browser agents and web surfers.

### Work modes

- `architect`: focus on analysis, alternatives, and planning before edits
- `ask`: focus on explanation, diagnosis, and low-mutation guidance
- `code`: default implementation-oriented mode

## Built-in Tools

### File Operations

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `read_file`        | Read files with line numbers        |
| `edit_file`        | Exact-match file editing            |
| `write_file`       | Create files or helper scripts      |
| `list_files`       | Glob-based file discovery           |

### Search & Analysis

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `grep`             | Fast content search with ripgrep    |
| `get_repo_map`     | Semantic repository map             |
| `get_project_info` | Project metadata                    |
| `graph_query`      | Knowledge graph queries             |
| `ts_check`         | TypeScript diagnostics & hover info |

### Execution

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `run_command`      | Shell execution (sandboxed)         |
| `powershell`       | PowerShell execution (Windows)      |
| `git_command`      | Safe git operations                 |
| `browser_action`   | **Antigravity Browser** (Playwright) |
| `pending_messages` | Manage async task queue (Mailbox)   |

### Browser Actions (`browser_action`)

The Antigravity Browser engine supports **17 actions** for comprehensive web automation:

#### Navigation & History

| Action | Parameters | Description |
|--------|------------|-------------|
| `navigate` | `url` | Go to a URL |
| `back` | - | Go back in browser history |
| `forward` | - | Go forward in browser history |

#### Multi-Tab Management

| Action | Parameters | Description |
|--------|------------|-------------|
| `new_tab` | `url` | Open URL in a new tab |
| `switch_tab` | `tab_index` or `tab_title` | Switch to a tab by index or title substring |
| `close_tab` | - | Close current tab |
| `list_tabs` | - | List all open tabs with titles and URLs |

#### Interaction

| Action | Parameters | Description |
|--------|------------|-------------|
| `click` | `selector` or `text` | Click an element by CSS selector or text content |
| `type` | `selector`, `text` | Type text into an input field |
| `wait` | `selector`, `timeout` | Wait for an element to appear (default: 30s) |
| `upload` | `selector`, `file_path` | Upload a file to a file input element |

#### Content & Analysis

| Action | Parameters | Description |
|--------|------------|-------------|
| `extract` | - | Get page text content and interactive elements tree |
| `evaluate` | `script` | Run custom JavaScript in page context |
| `metrics` | - | Get performance metrics (load time, FCP, resource count) |

#### Visual & Navigation

| Action | Parameters | Description |
|--------|------------|-------------|
| `screenshot` | `file_path` | Capture current page as PNG image |
| `scroll` | `direction`, `amount` | Scroll page (up/down/top/bottom) with smooth animation |
| `status` | - | Check if browser is running and current URL |

**Features:**

- 🎨 **Premium HUD** with orange border, status indicator, and REC badge
- 💫 **Visual Ripples** on click interactions
- 🎯 **Element Highlighting** before actions
- 📹 **Video Recording** saved to `.recordings/` folder
- 🔄 **Smooth Scrolling** with cubic-bezier animation

### Task Management

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `todo_write`       | Structured task board               |
| `ask_user_choice`  | Ask the user to pick an option      |
| `reflect`          | Self-reflection and reasoning       |

### Web & Internet

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `web_fetch`        | Fetch URL content                   |
| `web_search`       | Search the web                      |
| `youtube_transcript` | Extract YouTube video transcripts |
| `twitter_read`     | Read tweets and threads             |
| `reddit_read`      | Read Reddit posts and comments      |
| `social_doctor`    | Diagnose social media tool status   |

### Office Documents

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `office`           | Create/edit .docx, .xlsx, .pptx     |
| `office_doctor`    | Diagnose OfficeCLI installation     |

### Memory Management

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `memory_archive`   | Store information to memory         |
| `memory_recall`    | Retrieve information from memory    |
| `memory_list`      | List memory entries                 |
| `memory_forget`    | Remove memory entries               |

### Agents & Plugins

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `spawn_agent`      | Delegate to a sub-agent             |
| `list_plugins`     | Show built-in and MCP plugin groups |

### MCP & Remote

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `mcp`              | MCP server management               |
| `mcp_resources`    | MCP resource discovery              |
| `mcp_auth`         | MCP OAuth authentication            |
| `bridge`           | Bridge server for remote control    |
| `direct_connect`   | Direct WebSocket connections        |

### Notifications & Alerts

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `notify`           | Send desktop notifications          |

### Notebook Editing

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `notebook_edit`    | Edit Jupyter notebook cells         |

MCP tools are loaded dynamically from `.mcp.json` and appear as additional tool namespaces at runtime.

## Slash Commands

JimCode includes a comprehensive command system with 20+ slash commands:

### Git Commands

| Command | Description |
|---------|-------------|
| `/commit [message]` | Stage and commit changes |
| `/review [file]` | Code review with suggestions |
| `/diff [file]` | Show diff with explanations |
| `/branch [action] [name]` | Branch management |

### Context Commands

| Command | Description |
|---------|-------------|
| `/memory` | View memory files |
| `/context` | Show current context |
| `/compact` | Compact conversation |

### Session Commands

| Command | Description |
|---------|-------------|
| `/session [action]` | Session management |
| `/resume [id]` | Resume previous session |

### Config Commands

| Command | Description |
|---------|-------------|
| `/model [name]` | Switch model |
| `/config [action]` | Configuration management |
| `/permissions [action]` | Permission management |

### Dev Commands

| Command | Description |
|---------|-------------|
| `/doctor` | System diagnostics |
| `/init` | Project initialization |
| `/stats` | Usage statistics |

### Tools Commands

| Command | Description |
|---------|-------------|
| `/plugin [action]` | Plugin management |
| `/skills [action]` | Skill management |
| `/tasks [action]` | Task management |
| `/hooks [action]` | Hook management |
| `/mcp [action]` | MCP server management |
| `/queue` | View pending messages queue |
| `/next` | Process next task from queue |
| `/browser` | Show active browser status |

## Bridge System (Remote Control)

JimCode includes a bridge system for remote control via WebSocket:

```bash
# Start bridge server
/bridge start

# Check status
/bridge status

# Stop bridge server
/bridge stop
```

Features:

- WebSocket server on configurable port
- Session authentication with tokens
- Real-time command execution from remote
- File operations from remote
- Session state synchronization
- Heartbeat/ping-pong for connection health

## Keybinding System

JimCode supports customizable keybindings with chord support:

- Ctrl+C: Cancel current operation
- Ctrl+D: Exit application
- Ctrl+L: Clear screen
- Ctrl+K: Clear input line
- Ctrl+A: Move cursor to start
- Ctrl+E: Move cursor to end
- Tab: Autocomplete
- Enter: Submit input
- Escape: Cancel

Chord examples:

- Ctrl+K, Ctrl+S: Save
- Ctrl+K, Ctrl+R: Run

## Notifications

JimCode can send desktop notifications for:

- Task completion
- Error alerts
- System status updates

Supported platforms:

- macOS: osascript
- Windows: PowerShell toast notifications
- Linux: notify-send (with bell fallback)

## Telemetry & Diagnostics

JimCode includes:

- Usage telemetry for analytics
- System diagnostics via `/doctor`
- Rate limiting for API usage
- Health monitoring

## Vim Mode

JimCode supports Vim keybindings:

- Normal mode: h/j/k/l navigation
- Insert mode: Standard text input
- Visual mode: Text selection
- Command mode: :w, :q, :wq commands

## Planning and Approval

Jim is built to plan before mutating.

- For complex work, the agent should create a task board with `todo_write`
- In `plan` and `edit` modes, mutation tools are blocked until the current plan is approved
- In the UI, you can approve a plan with `/approve`

The task board supports:

- `pending`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`
- `priority`
- `owner`
- `depends_on`
- `acceptance_criteria`
- `notes`

## Sessions and Checkpoints

Jim persists runtime state under `~/.jim`.

- Sessions live in `~/.jim/sessions`
- Checkpoints live in `~/.jim/checkpoints`
- Permission decisions also persist under `~/.jim`
- The CLI can browse sessions and checkpoints interactively

## Memory

Jim loads project memory from the repo when available:

- `CLAUDE.md` / `AGENTS.md`
- `LEARNING.md` / `SECURITY.md` / `CONTRIBUTING.md`
- `CLAUDE.local.md`
- `.claude/rules/*.md`
- `MEMORY.md`

Jim also provides runtime memory tools for storing and recalling information during conversations.

## Documentation

For more detailed information, see:

- [LEARNING.md](./LEARNING.md): How Jim learns and adapts to your style.
- [SECURITY.md](./SECURITY.md): Security policy, permissions, and guardrails.
- [CONTRIBUTING.md](./CONTRIBUTING.md): Guidelines for extending Jim and adding new tools.
- [LICENSE](./LICENSE): MIT License terms.

Example conditional rule:

```markdown
---
globs: ["*.ts", "src/**/*.js"]
description: TypeScript rules
alwaysApply: false
---

Use strict TypeScript. Prefer `type` over `interface`.
```

## Hooks

Jim loads hooks from `.hooks.json`.

Example:

```json
[
  {
    "event": "PostToolUse",
    "toolPattern": "edit_file",
    "command": "npx prettier --write . 2>/dev/null || true",
    "description": "Auto-format after edit"
  }
]
```

Supported workflows include lifecycle automation around sessions, tools, and checkpoints.

## MCP

Jim can connect to MCP servers from `.mcp.json`.

Example:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

At runtime Jim:

- loads MCP servers
- registers MCP tools dynamically
- refreshes tools when servers report changes
- shows plugin groups through `/plugins`

### MCP Authentication

For enterprise MCP servers requiring OAuth:

```bash
/mcp_auth server=myservice auth_type=oauth token=your_token
```

## Models

Jim supports multiple models through various providers. Use `/models` to list available models or `/provider` to view current provider details.

The selected model can be set with `OPENAI_MODEL` or the `/model` command.

Provider selection can be controlled with `API_MODE`:

- `auto`: recommend an adapter from the current model and retry with the alternate wire format on schema mismatch
- `openai`: force the OpenAI Responses API adapter
- `openai-compatible`: force the OpenAI-compatible Chat Completions adapter

You can also switch provider modes inside the CLI with `/provider`, `/providers`, and `/adapters`.

## Provider Presets

Jim ships with an extensive provider preset catalog:

### Popular Providers

| Provider | Description |
|----------|-------------|
| `opencode-zen` | Curated models including Claude, GPT, Gemini |
| `opencode-go` | Low cost subscription for everyone |
| `anthropic` | Direct access to Claude models |
| `openai` | GPT models for fast, capable AI tasks |
| `openrouter` | Universal gateway with per-model pricing |

### Other Providers

| Provider | Description |
|----------|-------------|
| `azure-openai` | Enterprise-grade OpenAI on Microsoft Azure |
| `amazon-bedrock` | AWS-native provider with SigV4 signing |
| `google` | Gemini models via Vertex AI or Studio |
| `groq` | Ultra-fast inference for open source models |
| `mistral` | Mistral and Mixtral models |
| `xAI` | Grok models via OpenAI-compatible endpoint |
| `perplexity` | Search-augmented LLM API |
| `together-ai` | Open source models at high speed |
| `deepinfra` | Low-cost inference for open models |
| `cerebras` | Wafer-scale AI inference |
| `deepseek` | High-performance models like DeepSeek V3 and R1 |
| `kilocode` | High-speed coding specialized models |
| `minimax` | MiniMax-m2.5 specialized in short/long context |
| `moonshot` | Kimi models for long context research |
| `ollama` | Run models locally on your machine |

Use `/connections` to see all available presets and their configuration status.

## Office Documents

Jim provides tools for creating, reading, and modifying Office documents:

- Create .docx, .xlsx, .pptx files
- Add and modify content (text, shapes, slides, cells)
- Query and validate document structure
- Batch operations support

Requires [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) installation. Run `office_doctor` to check status.

## Social Media Access

Jim can read content from social media platforms:

- **YouTube**: Extract video transcripts and metadata
- **Twitter/X**: Read tweets and threads (requires bird CLI + auth)
- **Reddit**: Read posts with comments via JSON API

Run `social_doctor` to check which tools are available on your system.

## Development

```bash
# install
npm install

# run dev CLI
npm run dev

# typecheck/build
npm run build

# run tests
npm test

# watch tests
npm run test:watch

# run legacy tool tests
npm run test:legacy
```

## Tech Stack

- `TypeScript`
- `React 19`
- `Ink`
- `OpenAI SDK`
- `ts-morph`
- `zod`
- `pino`
- `vitest`
- `ws` (WebSocket for bridge)

## Architecture

### Core Systems

- **Agent Loop**: Main execution loop with tool orchestration
- **Query Pipeline**: Message processing with streaming support
- **Tool Registry**: Dynamic tool registration and management
- **Permission System**: Multi-layer security with rule engine
- **Context Manager**: Session state and memory management

### Services

- **Bridge Server**: WebSocket-based remote control
- **Notifications**: Desktop notification service
- **Telemetry**: Usage analytics and tracking
- **Diagnostics**: System health monitoring
- **Rate Limits**: API usage management
- **Keybindings**: Customizable keyboard shortcuts
- **Voice**: Voice integration support
- **Buddy**: Companion system for UX enhancement

### Agent Features

- **Sub-agents**: Parallel task execution
- **Swarm**: Multi-agent orchestration
- **Tree Search**: Monte Carlo simulation for planning
- **Reflexion**: Self-critique system
- **Session Memory**: Persistent conversation state
- **Compaction**: Context window management

## Acknowledgments

JimCode is inspired by and grateful to the following projects:

- **[Claude Code](https://github.com/anthropics/claude-code)** — Anthropic's terminal-based AI coding agent. Claude Code's architecture, tool system, and planning workflow served as a major inspiration for JimCode's design.
- **[OpenCode](https://github.com/opencode-ai/opencode)** — Open-source AI coding agent with multi-provider support. OpenCode's provider abstraction and extensible architecture influenced JimCode's multi-model approach.
- **[Codex](https://github.com/openai/codex)** — OpenAI's coding agent that demonstrated the power of AI-assisted development with tool use and sandboxed execution.
- **[Cline](https://github.com/cline/cline)** — VS Code extension for AI coding assistance. Cline's approach to tool integration and user interaction patterns helped shape JimCode's CLI experience.
- **[Antigravity](https://github.com/antigravity-ai/antigravity)** — Innovative AI development environment that pushed boundaries in terminal-based AI tooling.

We thank the maintainers and contributors of these projects for their pioneering work in AI-assisted software development. JimCode builds upon their ideas while adding unique features like knowledge graphs, reflexion engines, multi-agent orchestration, and persona learning.

## License

MIT License

Copyright (c) 2024-2026 JonusNattapong
