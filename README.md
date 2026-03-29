# JimCode

<img src="assets/logo-github.png" alt="JimCode" width="640" />

JimCode is an open-source, terminal-based agent framework for code understanding and generation. It features a proactive learning loop inspired by Hermes, with built-in tools for file manipulation, shell commands, web access, and more. JimCode supports multiple LLM providers, dynamic tool loading via MCP, and structured workflows for planning and execution. The CLI includes interactive pickers for models and providers, session management, and a plugin catalog. JimCode is designed to be extensible and adaptable to your coding style.

## Highlights

- `Proactive learning loop` (Hermes-inspired) for persona and skill mastery
- `15 built-in tools` plus dynamic MCP tools
- `Multi-model CLI` with searchable model and provider pickers
- `Provider selection` with favorites, recents, presets, and native provider setup modals
- `Work modes` for `architect`, `ask`, and `code`
- `Task board` via `todo_write` with `blocked`, dependencies, owners, notes, and acceptance criteria
- `AI-driven choice prompts` via `ask_user_choice`
- `Plan approval` guardrail before mutation tools run
- `Sub-agents` with planner/executor/reviewer support
- `Sessions + checkpoints` persisted under `~/.jim`
- `Hooks`, `memory`, `MCP`, and `plugin catalog`
- `User Persona Modeling` persisted under `.jim/user_persona.json`
- `Self-Improving Skill Store` persisted under `.jim/skills/`
- `Structured documentation` for learning, security, and contribution
- `Structured logging` with `pino`
- `Semantic repo map` powered by `ts-morph`
- `Provider metadata registry` for adapter capabilities, transport, and model recommendations

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

### Work modes

- `architect`: focus on analysis, alternatives, and planning before edits
- `ask`: focus on explanation, diagnosis, and low-mutation guidance
- `code`: default implementation-oriented mode

## Built-in Tools

| Tool               | Purpose                             |
| ------------------ | ----------------------------------- |
| `read_file`        | Read files with line numbers        |
| `edit_file`        | Exact-match file editing            |
| `write_file`       | Create files or helper scripts      |
| `list_files`       | Glob-based file discovery           |
| `grep`             | Fast content search with ripgrep    |
| `run_command`      | Shell execution                     |
| `git_command`      | Safe git operations                 |
| `get_project_info` | Project metadata                    |
| `get_repo_map`     | Semantic repository map             |
| `todo_write`       | Structured task board               |
| `ask_user_choice`  | Ask the user to pick an option      |
| `web_fetch`        | Fetch URL content                   |
| `web_search`       | Search the web                      |
| `list_plugins`     | Show built-in and MCP plugin groups |
| `spawn_agent`      | Delegate to a sub-agent             |

MCP tools are loaded dynamically from `.mcp.json` and appear as additional tool namespaces at runtime.

## CLI Commands

```text
/reset              Clear conversation
/approve            Approve the current plan
/model [name]       Show or switch model
/models             List models
/provider [name]    Show or switch auto|openai|openai-compatible
/providers          Pick a provider adapter (engine type)
/connect [name]     Connect to a service (Kilocode, OpenRouter, etc.)
/connections        List all available provider presets
/mode <mode>        Permission mode (plan/default/acceptEdits/dontAsk)
/auto-approve       Toggle auto-approve
/workmode [name]    Show or switch architect|ask|code
/modes              Pick a work mode interactively
/learn <fact>       Save a fact to memory
/rules              Show conditional rules
/compact            Compact conversation context
/stream             Toggle streaming mode
/sessions           Browse saved sessions
/load <id>          Load a session
/delete <id>        Delete a session
/checkpoint <label> Create a checkpoint
/checkpoints        Browse checkpoints
/restore <id>       Restore a checkpoint
/plugins            Browse plugin catalog
/hooks              Show configured hooks
/memory             Show loaded memory layers
/config             Show current config
/stats              Show usage statistics
/history            Message stats
/help               Show help
/quit               Exit
```

## Planning and Approval

Jim is built to plan before mutating.

- For complex work, the agent should create a task board with `todo_write`
- In `plan`, `default`, and `acceptEdits` modes, mutation tools are blocked until the current plan is approved
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

## Models

Jim currently exposes an interactive picker for these models:

- `minimax/minimax-m2.5:free`
- `minimax/minimax-m2.7`
- `kilocode/kilocode-frontier`
- `kilo-auto/balanced`
- `anthropic/claude-3-5-sonnet-20241022`
- `anthropic/claude-3-5-haiku-20241022`
- `openai/gpt-4o`
- `openai/o1-mini`
- `google/gemini-1.5-pro`
- `google/gemini-1.5-flash`
- `openrouter/google/gemini-pro-1.5`
- `openrouter/anthropic/claude-3.5-sonnet`

The selected model can also be set with `OPENAI_MODEL`.

Provider selection can be controlled with `API_MODE`:

- `auto`: recommend an adapter from the current model and retry with the alternate wire format on schema mismatch
- `openai`: force the OpenAI Responses API adapter
- `openai-compatible`: force the OpenAI-compatible Chat Completions adapter

Legacy aliases still work:

- `responses` => `openai`
- `chat-completions` => `openai-compatible`

You can also switch provider modes inside the CLI with `/provider` and `/providers`.

Provider connection presets can be controlled with `PROVIDER_PRESET` or the `/connect` command.

The interactive pickers support:

- search-as-you-type filtering
- grouped `Favorites`, `Recent`, and `All` sections when no search is active
- `ctrl+f` to toggle favorites

The `/connect` flow opens a modal in the TUI and persists provider-specific settings in `.jim/provider.json`.

Jim ships with an OpenCode-inspired provider preset catalog. It includes the providers documented by OpenCode, and marks each preset as either:

- `simple`: can be connected directly in Jim with an OpenAI/OpenAI-compatible base URL
- `catalog-only`: tracked in the preset catalog, but still needs a future native integration in Jim

Examples:

- `PROVIDER_PRESET=openai`
- `PROVIDER_PRESET=openrouter`
- `PROVIDER_PRESET=ollama`
- `PROVIDER_PRESET=lm-studio`

Jim now maintains a provider metadata registry internally. Each provider entry includes:

- transport type
- endpoint family
- capability flags like `streaming`, `tools`, `reasoning`, `vision`, and `mcp`
- recommended model patterns for auto-selection

The CLI uses this registry to:

- recommend the best adapter for the current model
- enrich `/provider` and `/providers` with capability details
- keep auto-selection logic and UI labels in sync

Relevant OpenAI docs:

- Responses API and tools: <https://developers.openai.com/api/docs/guides/tools>
- Migrating Chat Completions to Responses: <https://developers.openai.com/api/docs/guides/migrate-to-responses>
- Model endpoint support: <https://developers.openai.com/api/docs/models>

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

## License

MIT
