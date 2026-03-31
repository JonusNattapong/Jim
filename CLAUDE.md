# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 35+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, hooks, sub-agents, and a self-improving learning system.

- **Runtime**: Node.js >= 20.0.0
- **Module system**: ESM (`"type": "module"`)
- **Package manager**: pnpm (lockfile present) or npm
- **Language**: TypeScript (strict mode, `NodeNext` module resolution)

## Build / Test / Dev Commands

```bash
# Install dependencies
pnpm install          # or npm install

# Development (tsx for hot-reload)
pnpm dev              # or npm run dev

# Build TypeScript to dist/
pnpm build            # or npm run build

# Run the built CLI
pnpm start            # or npm start

# Run all tests
pnpm test             # or npm test (vitest run)

# Run a single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching a name pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch       # or npm run test:watch

# Legacy tool tests
pnpm test:legacy      # or npm run test:legacy

# Smoke test
pnpm smoke:exit
```

## High-Level Architecture

### Core Systems

**1. Agent Runtime** (`src/agent/`)
- `loop.ts`: Main agent execution loop, orchestrates tool calls and LLM interactions
- `provider.ts`: LLM provider abstraction supporting OpenAI, Anthropic, and 15+ providers
- `subagent.ts`: Sub-agent spawning for parallel task execution
- `swarm.ts`: Multi-agent swarm orchestration for complex workflows
- `reflexion.ts`: Self-reflection and learning engine
- `hooks.ts`: Lifecycle hook system for automation

**2. Tool System** (`src/tools/`)
- `registry.ts`: Central tool registry with plugin management
- `types.ts`: Tool definition and handler type interfaces
- Each tool exports a `*_definition` (schema) and `*_handler` (implementation)
- Built-in plugins: `file-ops`, `system`, `search`, `social`, `office`, `memory`, `agent-intelligence`

**3. CLI Interface** (`src/cli/`)
- `index.tsx`: Entry point using Ink/React TUI
- `app.tsx`: Main application component
- `components/`: UI components (Header, Chat, ToolResult, etc.)
- `hooks/`: React hooks for virtual scrolling, prompt history
- `stores/`: State management for tasks, sessions, prompt history

**4. Context Management** (`src/context/`)
- `manager.ts`: Context window and token management
- `memory.ts`: Long-term memory storage and retrieval
- `sessions.ts`: Session persistence under `~/.jim/sessions`
- `persona.ts`: User persona learning and adaptation
- `memory-store.ts`: Archival memory for long-term storage

**5. Permissions & Security** (`src/permissions/`)
- `manager.ts`: Permission modes (ask/default/acceptEdits/dontAsk)
- `rule-engine.ts`: Permission rule evaluation
- `security-policy.ts`: Security policies and guardrails

**6. Knowledge Graph** (`src/graph/`)
- `knowledge-graph.ts`: Codebase understanding via ts-morph
- `ast-extractor.ts`: AST parsing for TypeScript projects
- `cache.ts`: Graph caching for performance

**7. Configuration** (`src/config/`)
- `provider-presets.ts`: 20+ provider presets (OpenAI, Anthropic, Azure, etc.)
- `provider-store.ts`: Provider settings persistence
- `schemas.ts`: TypeBox validation schemas

**8. Services** (`src/services/`)
- `pending-messages.ts`: Async message queue (Mailbox)
- `context-compaction.ts`: Context window compaction
- `session-memory.ts`: Session memory management
- `lsp/`: Language server protocol integration

### Data Flow

```
User Input → CLI (Ink/React) → Agent Loop → LLM Provider
                                    ↓
                              Tool Registry
                                    ↓
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                File Ops        Web/Social      Memory/Context
```

### Tool Categories

**File Operations**: `read_file`, `edit_file`, `write_file`, `list_files`, `grep`, `undo_edit`
**System**: `run_command`, `powershell`, `git_command`, `worktree_manage`, `cleanup_workspace`
**Search**: `web_fetch`, `web_search`, `get_repo_map`, `graph_query`
**Social Media**: `youtube_transcript`, `twitter_read`, `reddit_read`, `social_doctor`
**Office Documents**: `office`, `office_doctor` (requires OfficeCLI)
**Memory**: `memory_archive`, `memory_recall`, `memory_list`, `memory_forget`
**Agent Intelligence**: `todo_write`, `reflect`, `ts_check`, `spawn_agent`, `browser_action`, `task_manage`, `mailbox`, `pending_messages`

### Provider System

Jim supports 20+ LLM providers via the provider preset system:
- **Adapters**: `openai` (Responses API), `openai-compatible` (Chat Completions)
- **Presets**: openai, anthropic, azure-openai, amazon-bedrock, google, groq, mistral, xAI, perplexity, together-ai, deepinfra, cerebras, deepseek, kilocode, minimax, moonshot, ollama

Provider selection flow:
1. Check `PROVIDER_PRESET` env var or saved selection
2. Resolve preset via `resolveProviderPreset()`
3. Apply environment assignments from preset
4. Create provider via `createProvider()` with mode (`auto`/`openai`/`openai-compatible`)

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files, `camelCase.ts` for other modules
- **Tool exports**: `tool_name_definition` and `tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail

### Tool Implementation Pattern

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* schema */ },
      required: ["param1"],
    },
  },
};

export const my_tool_handler: ToolHandler = async (args) => {
  try {
    // implementation
    return { content: "success message" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error: ${msg}`, isError: true };
  }
};
```

### Tests

- Framework: **Vitest** (config in `vitest.config.ts`)
- Test files: `*.test.ts` co-located with source
- Timeout: 15s per test, 10s per hook
- Max 4 parallel workers
- Use `beforeEach`/`afterEach` for setup/teardown

### Logging

- Use `pino` via `childLogger`: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

## Key Files & Entry Points

- **`src/cli/index.tsx`**: CLI entry point (Ink/React TUI)
- **`src/agent/loop.ts`**: Central agent orchestration
- **`src/agent/provider.ts`**: LLM provider abstraction
- **`src/tools/registry.ts`**: Tool registration and management
- **`src/tools/index.ts`**: Tool exports barrel file
- **`src/context/manager.ts`**: Context and token management

## Configuration Files

- **`.hooks.json`**: Lifecycle hooks for automation
- **`.mcp.json`**: MCP server configuration
- **`~/.jim/`**: Session storage, checkpoints, and memory
- **`.jim/user_persona.json`**: Learned user persona
- **`.jim/skills/`**: Self-improving skill store

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...          # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai       # Provider connection preset
MAX_TURNS=25                 # Max agent turns per run
MAX_TOOL_OUTPUT=5000         # Truncate tool output chars
PERMISSION_MODE=default      # Permission mode (ask/default/acceptEdits/dontAsk)
LOG_LEVEL=debug              # Pino log level

# Social media / internet
BRAVE_SEARCH_API_KEY=...     # Optional: Brave Search
FIRECRAWL_API_KEY=...        # Optional: Firecrawl
AUTH_TOKEN=...               # Twitter/X auth token
CT0=...                      # Twitter/X ct0 cookie
REDDIT_PROXY=...             # Optional: proxy for Reddit
```

## External Dependencies

- **Office Documents**: Requires [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)
- **YouTube transcripts**: Requires `yt-dlp` (`pip install yt-dlp`)
- **Twitter/X**: Requires `@steipete/bird` CLI with cookie auth
- **Browser**: Uses Playwright Core for browser automation
