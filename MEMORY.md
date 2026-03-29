# Project Memory

- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.

- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moltbot** is a personal AI assistant that operates across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.) with a local-first Gateway architecture. It features a WebSocket control plane, Pi agent runtime, multi-channel routing, voice wake/talk modes, live Canvas workspace, and companion apps for macOS/iOS/Android.

Primary repository: `moltbot/` (main project)
- WhatsApp gateway CLI (Baileys web) with Pi RPC agent
- TypeScript ESM, Node 22+, pnpm
- Architecture: Gateway WS control plane + multi-channel inbox + Pi agent runtime

## Development Commands

### Essential Setup & Build
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Watch mode for development
pnpm gateway:watch  # auto-reload gateway on TS changes
pnpm dev            # run CLI in dev mode

# Run the CLI
pnpm moltbot [command]
# or
node dist/index.js [command]
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage (70% threshold)
pnpm test:coverage

# Run e2e tests
pnpm test:e2e

# Run live tests (requires real API keys)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker-based tests
pnpm test:docker:all
```

### Linting & Formatting
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Format and fix
pnpm format:fix

# Check formatting without changes
pnpm format
```

### Development Workflow
```bash
# Start gateway in dev mode
pnpm gateway:dev

# Start TUI interface
pnpm tui

# Run UI build (separate from main build)
pnpm ui:build

# Protocol code generation
pnpm protocol:gen
pnpm protocol:gen:swift

# Check protocol is up to date
pnpm protocol:check
```

## High-Level Architecture

### Core Components

**1. Gateway WebSocket Control Plane** (`src/gateway/`)
- Central server managing sessions, channels, tools, and events
- WebSocket API for clients (CLI, web UI, macOS app, mobile nodes)
- Handles configuration, authentication, model routing
- Protocol: `src/gateway/protocol/index.ts`

**2. Agent Runtime** (`src/agents/`)
- Pi agent integration for AI conversations
- RPC mode with tool streaming and block streaming
- Session management with isolation and routing
- Multi-agent support with `sessions_*` tools

**3. Channel System** (`src/channels/`, built-in channels in `src/`)
- **Built-in**: WhatsApp (Baileys), Telegram (grammY), Discord, Slack, Signal, iMessage, Web
- **Extensions**: Microsoft Teams, Matrix, Zalo, BlueBubbles, voice-call
- Each channel handles inbound/outbound messaging, media, presence
- Unified message format via `channel-web.ts` adapter

**4. CLI Surface** (`src/cli/`, `src/commands/`)
- Commander-based CLI with subcommands
- Commands: `gateway`, `agent`, `message send`, `channels`, `config`, `wizard`, `doctor`
- Profile-based configuration with `--profile` flag
- Progress indicators and interactive prompts

**5. Browser Control** (`src/browser/`)
- Managed Chrome/Chromium instance via CDP
- Snapshots, actions, uploads, profiles
- Tool integration for web automation

**6. Canvas Host** (`src/canvas-host/`)
- A2UI (Agent-to-UI) protocol for visual workspace
- Agent-driven canvas rendering and interaction
- Push/reset/eval/snapshot operations

**7. Media Pipeline** (`src/media/`, `src/media-understanding/`)
- Images, audio, video processing
- Transcription hooks, size caps, temp file lifecycle
- Media understanding for AI processing

### Key Subsystems

**Session Model** (`src/sessions/`)
- `main` session for direct chats
- Group isolation with activation modes
- Queue modes, reply-back, context management
- Per-session configuration (model, sandbox, etc.)

**Routing System** (`src/routing/`)
- Channel-based routing to agents
- Group rules and mention gating
- Per-channel chunking and delivery policies
- Allowlist/denylist matching

**Configuration** (`src/config/`)
- JSON config with TypeBox validation
- Session store in `~/.clawdbot/`
- Profile-based environment injection
- Hot-reload with `config-reload.ts`

**Security Model**
- Default: tools run on host for `main` session
- Group safety: `agents.defaults.sandbox.mode: "non-main"` for Docker isolation
- Pairing system for DM access control
- Web UI intended for local use only

**Node System** (`src/node-host/`, macOS/iOS/Android)
- Device-local actions: camera, screen recording, system.run/notify
- Node pairing via Bridge protocol
- TCC permission management on macOS

### Data Flow

```
Messaging Channels (WhatsApp/Telegram/Slack/etc.)
           │
           ▼
    Gateway (WebSocket Control Plane)
           │
    ┌───────┼───────┬────────────┐
    │       │       │            │
    ▼       ▼       ▼            ▼
 Agent   CLI    Web UI      macOS App
 (Pi)   (TS)   (Hono)     (SwiftUI)
           │
           ├─ Browser Control (CDP)
           ├─ Canvas Host (A2UI)
           ├─ Nodes (macOS/iOS/Android)
           └─ Tools (bash, read, write, etc.)
```

### Platform Integration

**macOS** (`src/macos/`)
- Menu bar app with gateway control
- Voice Wake + Talk Mode overlay
- WebChat + debug tools
- Remote gateway control

**iOS/Android** (`apps/ios/`, `apps/android/`)
- Node mode with Canvas, camera, screen recording
- Bonjour pairing
- Voice trigger forwarding

**Web Surfaces** (`src/web/`)
- Control UI served from Gateway
- WebChat over WebSocket
- No separate port needed

## Key Files & Entry Points

- **`src/index.ts`**: Main CLI entry point with Commander program
- **`src/entry.ts`**: Node process bootstrapping, Windows argv normalization
- **`src/gateway/server.ts`**: Gateway WebSocket server implementation
- **`src/gateway/client.ts`**: Client connection handling
- **`moltbot.mjs`**: Executable CLI entry (binary)
- **`package.json`**: Build scripts, dependencies, exports

### Critical Directories

```
src/
├── gateway/          # WebSocket control plane
├── cli/              # CLI commands & wiring
├── commands/         # Command implementations
├── agents/           # Pi agent runtime & tools
├── channels/         # Channel routing & registry
├── routing/          # Message routing logic
├── sessions/         # Session management
├── config/           # Configuration & sessions store
├── browser/          # Browser automation
├── canvas-host/      # A2UI canvas system
├── media/            # Media processing pipeline
├── node-host/        # Device node integration
├── slack/            # Slack channel
├── discord/          # Discord channel
├── telegram/         # Telegram channel
├── whatsapp/         # WhatsApp channel
├── imessage/         # iMessage channel
├── signal/           # Signal channel
└── web/              # Web UI surfaces
```

## Documentation & Resources

- **Full docs**: https://docs.molt.bot
- **Architecture**: https://docs.molt.bot/concepts/architecture
- **Gateway runbook**: https://docs.molt.bot/gateway
- **Configuration**: https://docs.molt.bot/gateway/configuration
- **Channels**: https://docs.molt.bot/channels
- **Security**: https://docs.molt.bot/gateway/security
- **Skills platform**: https://docs.molt.bot/tools/skills
- **ClawdHub (skills registry)**: https://ClawdHub.com

## Development Notes

### Runtime Requirements
- **Node.js**: 22.12.0+ (enforced in `src/infra/runtime-guard.ts`)
- **Package Manager**: pnpm (v10.23.0) with Bun support
- **Platform**: macOS (native), Linux, Windows (WSL2 recommended)

### Build System
- **TypeScript**: ESM with NodeNext module resolution
- **Compiler**: `tsc` with strict mode
- **Build optimization**: wireit for incremental builds
- **UI bundling**: Rolldown for Canvas A2UI
- **Output**: `dist/` directory with barrel exports

### Testing Strategy
- **Framework**: Vitest with V8 coverage (70% thresholds)
- **Test types**: Unit (`.test.ts`), E2E (`.e2e.test.ts`), Live (`.live.test.ts`)
- **Exclusions**: CLI/wiring, integration surfaces covered by e2e/manual
- **Workers**: Max 16 test workers (enforced in config)

### Code Style
- **Linter**: oxlint with type-aware checking
- **Formatter**: oxfmt (Prettier alternative)
- **Naming**: `Moltbot` for product/app/docs, `moltbot` for CLI/config
- **Type safety**: Strict TypeScript, avoid `any`
- **File size**: ~700 LOC guideline, prefer helpers over "V2" copies

### Dependency Management
- **Core deps**: In root `package.json`
- **Plugin deps**: In extension `package.json` (runtime in `dependencies`)
- **Avoid**: `workspace:*` in `dependencies` (breaks npm install)
- **Patching**: Requires explicit approval (pnpm patches/overrides)

### Release Channels
- **stable**: Tagged releases (`vYYYY.M.D`), npm `latest`
- **beta**: Prereleases (`vYYYY.M.D-beta.N`), npm `beta`
- **dev**: Moving `main`, npm `dev`

### Common Workflows

**Adding a new channel**:
1. Create channel dir: `src/<channel-name>/`
2. Implement provider interface
3. Add to `src/channels/registry.ts`
4. Update docs: `docs/channels/<channel>.md`
5. Add tests and status probes
6. Update routing/allowlist docs

**Adding a new tool**:
1. Implement tool in `src/agents/tools/`
2. Define TypeBox schema
3. Add to tool registry
4. Update security docs if needed
5. Write tests

**Gateway development**:
- Use `pnpm gateway:watch` for hot reload
- Connect with `pnpm moltbot gateway run --bind loopback --port 18789`
- Check logs with `moltbot doctor` or unified logs on macOS

## Important Configuration

### Environment Variables
- `CLAWDBOT_PROFILE`: CLI profile mode
- `CLAWDBOT_NO_RESPAWN`: Disable process respawn
- `NODE_OPTIONS`: Set to suppress experimental warnings
- `NO_COLOR` / `FORCE_COLOR`: Color output control
- `CLAWDBOT_LIVE_TEST`: Enable live API tests

### Config Paths
- **Config**: `~/.clawdbot/moltbot.json`
- **Credentials**: `~/.clawdbot/credentials/`
- **Sessions**: `~/.clawdbot/sessions/`
- **Skills**: `~/clawd/skills/`

### Ports
- **Default Gateway**: 18789 (configurable via `--port`)
- **Auto-detection**: `ensurePortAvailable()` with error handling
- **Tailscale**: Serve/Funnel for remote access

## Troubleshooting

**Gateway won't start**:
```bash
moltbot doctor  # Check configuration and migrations
pnpm build      # Ensure TypeScript compiled
# Check port availability
ss -ltnp | rg 18789
```

**Test failures**:
- Check Node version (22.12.0+)
- Increase timeout if needed
- Run `pnpm test:force` for retries
- Check for race conditions in test suite

**Build errors**:
- Run `pnpm build` to see full errors
- Check TypeScript strict mode violations
- Verify imports and barrel exports

## Security Considerations

- **DM access**: Treated as untrusted input
- **Pairing required**: Unknown senders get pairing codes
- **Sandboxing**: Use `agents.defaults.sandbox.mode: "non-main"` for groups
- **Web UI**: Local-only, not hardened for public internet
- **Secrets**: Use `.env` and credentials store, never commit
- **Version pinning**: Patched deps must use exact versions

## Repository Structure Notes

This repository contains multiple projects. The main Moltbot project is in `moltbot/`. Other directories are independent projects or experiments. Always work within the `moltbot/` directory unless specifically instructed otherwise.
- [2026-03-29] # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support via provider adapters, MCP integration, session persistence, checkpoints, and a hook system.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run CLI in development mode (uses tsx for hot-reload)
pnpm dev

# Build TypeScript to dist/
pnpm build

# Run built CLI
pnpm start

# Run all tests
pnpm test

# Run single test file
pnpm vitest run src/agent/provider.test.ts

# Run tests matching pattern
pnpm vitest run -t "returns ChatCompletionsProvider"

# Watch mode for tests
pnpm test:watch
```

## High-Level Architecture

### Core Runtime Loop (`src/agent/loop.ts`)

The `Agent` class is the central orchestrator:

- **Provider Layer**: Abstracts OpenAI Responses API vs Chat Completions via `LLMProvider` interface (`src/agent/provider.ts`). The adapter is auto-selected based on model name unless overridden via `API_MODE`.
- **Tool Registry**: All tools register at startup via `ToolRegistry` (`src/tools/registry.ts`). MCP tools are loaded dynamically and re-registered when servers report changes.
- **Permission System**: Four modes (`plan`, `default`, `acceptEdits`, `dontAsk`) managed by `PermissionManager` (`src/permissions/manager.ts`). Persisted decisions live under `~/.jim/permissions.json`.
- **Context Management**: `ContextManager` (`src/context/manager.ts`) maintains conversation history with token counting via tiktoken. Supports LLM-based compaction via `/compact`.
- **Hook Engine**: Lifecycle events (`PreToolUse`, `PostToolUse`, `SessionStart`, etc.) trigger commands from `.hooks.json`.

### CLI TUI (`src/cli/`)

Ink-based React terminal UI:

- **Entry Point**: `src/cli/index.tsx` - bootstraps agent, loads config from env, renders Ink app
- **App Component**: `src/cli/app.tsx` - main event loop handling user input, tool execution, slash commands
- **Components**: Header, Message history, ToolActivity (live tool calls), StatusBar, PermissionPrompt, SearchablePicker (for models/providers)
- **UI State**: Recent selections and favorites persisted per-project in `.jim/ui-state.json`

### Provider Adapter System (`src/agent/provider.ts`)

Two implementations of `LLMProvider`:

- **ResponsesProvider**: OpenAI Responses API (newer, supports `computer-use-preview`, item-based output)
- **ChatCompletionsProvider**: OpenAI-compatible Chat Completions (universal compatibility)

Auto-selection logic in `inferProviderFromModel()` picks the best adapter based on model name patterns. Provider presets (`src/config/provider-presets.ts`) bundle connection settings for OpenCode-style catalogs.

### Tool System (`src/tools/`)

Tools are registered at runtime:

1. Built-in tools (file ops, search, shell, git, web, todo, sub-agents) registered in `ToolRegistry` constructor
2. MCP tools loaded from `.mcp.json` and registered dynamically after `agent.init()`
3. Each tool exports `*_definition` (OpenAI function schema) and `*_handler` (async function)

Dangerous tools (like `run_command`) are flagged; some permission modes auto-approve non-dangerous tools.

### Session & Checkpoint Persistence (`src/context/sessions.ts`)

- Sessions saved to `~/.jim/sessions/{id}.json` with full conversation context
- Checkpoints are named session snapshots in `~/.jim/checkpoints/`
- Session ID format: `{timestamp}-{random}`
- Restore via `/restore {id}` or load via `/load {id}`

### Memory System (`src/context/memory.ts`)

Loads context layers at startup:

- `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md` (project root)
- `.claude/rules/*.md` (conditional rules with glob patterns)
- `MEMORY.md`
- Learned facts via `/learn` stored in `.jim/memory.json`

### Config & Environment

Environment variables (loaded via `dotenv`):

```bash
OPENAI_API_KEY=sk-...              # Required
OPENAI_MODEL=gpt-4o                  # Default model
OPENAI_BASE_URL=...                  # Custom endpoint
API_MODE=auto|openai|openai-compatible  # Force adapter
PROVIDER_PRESET=openai               # Preset catalog ID
MAX_TURNS=25                         # Conversation limit
MAX_TOOL_OUTPUT=5000                 # Truncate threshold
PERMISSION_MODE=default              # default|plan|acceptEdits|dontAsk
LOG_LEVEL=debug                      # Pino log level
```

## Module Resolution

- **ESM only** (`"type": "module"`)
- **NodeNext** module resolution requires `.js` extensions on all relative imports
- Use `import type` for type-only imports
- Use `node:` prefix for Node.js builtins

## Testing

- **Framework**: Vitest
- **Config**: `vitest.config.ts` (15s timeout, 4 workers max)
- **Pattern**: Co-located `*.test.ts` files
- **Legacy**: `src/test/tools.test.ts` for early tool tests
- [2026-03-29] # Jim Agent Guide

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Jim** is a terminal-first AI coding agent built with TypeScript, React 19, and Ink. It provides 15+ built-in tools, multi-model support, MCP integration, sessions, checkpoints, and a hook system.

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
```

## Project Structure

```
src/
  agent/        # Core agent loop, provider adapters, sub-agents, hooks, prompt
  cli/          # Ink TUI app, CLI entry point (index.tsx)
  config/       # Provider presets, schemas, persistence
  context/      # Context manager, memory, sessions, token counting
  permissions/  # Permission modes (plan/default/acceptEdits/dontAsk)
  tools/        # All built-in tool definitions and handlers
  utils/        # Logger (pino), diff helpers, byte formatting
  test/         # Legacy test runner
```

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled. Avoid `any`; use `unknown` and narrow with type guards.
- Use `interface` for object shapes (e.g., `ToolDefinition`, `AgentConfig`).
- Export types with `export type` when re-exporting from barrel files.

### Imports

- Use `node:` prefix for Node.js builtins: `import { readFile } from "node:fs/promises"`
- Use `.js` extension for relative imports (required by `NodeNext`): `import { ToolRegistry } from "./registry.js"`
- Use `import type` for type-only imports: `import type { ToolDefinition, ToolHandler } from "./types.js"`
- Group imports: Node.js builtins first, then third-party, then local

### Naming Conventions

- **Files**: `snake_case.ts` for tool files (e.g., `read_file.ts`, `edit_file.ts`), `camelCase.ts` for other modules
- **Tool definitions**: Export as `const tool_name_definition` and `const tool_name_handler`
- **Classes**: PascalCase (`ToolRegistry`, `Agent`, `ContextManager`)
- **Interfaces**: PascalCase (`ToolDefinition`, `AgentConfig`, `ToolResult`)
- **Variables/functions**: camelCase

### Error Handling

- Catch errors with `catch (err: unknown)` and narrow: `err instanceof Error ? err.message : String(err)`
- Return `{ content: "...", isError: true }` from tool handlers on failure
- Use try/catch for all async operations that may fail (file I/O, HTTP, JSON parse)

### Tool Implementation Pattern

Each tool file follows this pattern:

```typescript
import type { ToolDefinition, ToolHandler } from "./types.js";

export const my_tool_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "my_tool",
    description: "What it does",
    parameters: {
      type: "object",
      properties: { /* zod-like schema */ },
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
- Test files: `*.test.ts` co-located with source (e.g., `provider.test.ts` next to `provider.ts`)
- Imports: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`
- Use `beforeEach`/`afterEach` for setup/teardown (e.g., temp directories)
- Timeout: 15s per test, 10s per hook (configured in vitest.config.ts)
- Max 4 parallel workers

### Logging

- Use `pino` via the `childLogger` utility: `import { childLogger } from "../utils/logger.js"`
- Create scoped loggers: `this.log = childLogger({ component: "agent" })`
- Log levels: `debug`, `info`, `warn`, `error`

### General Guidelines

- Keep files under ~300 LOC; extract helpers when needed
- No comments unless explicitly requested
- Prefer functional patterns; avoid unnecessary class hierarchies
- Use `zod` for runtime validation of external input
- The CLI entry point is `src/cli/index.tsx` (Ink/React TUI)
- The agent loop is in `src/agent/loop.ts` - this is the central orchestration point
- Hooks are loaded from `.hooks.json` at the project root
- Sessions persist under `~/.jim/sessions`

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
OPENAI_MODEL=gpt-4o          # Default model
OPENAI_BASE_URL=...           # Custom API base URL
API_MODE=auto|openai|openai-compatible  # Provider adapter
PROVIDER_PRESET=openai        # Provider connection preset
MAX_TURNS=25                  # Max agent turns per run
MAX_TOOL_OUTPUT=5000          # Truncate tool output chars
PERMISSION_MODE=default       # Permission mode
LOG_LEVEL=debug               # Pino log level
```