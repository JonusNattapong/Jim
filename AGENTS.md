# Jim Agent Guide

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

## Internet Access Tools

Jim provides native tools for reading social media and internet content (inspired by [Agent-Reach](https://github.com/Panniantong/Agent-Reach)):

| Tool | Platform | Backend | Config needed |
|------|----------|---------|---------------|
| `web_fetch` | Any URL | Jina Reader (free) / Firecrawl | No |
| `web_search` | Web search | Brave API / DuckDuckGo | Optional |
| `youtube_transcript` | YouTube | yt-dlp | `pip install yt-dlp` |
| `twitter_read` | Twitter/X | bird CLI | `npm i -g @steipete/bird` + cookies |
| `reddit_read` | Reddit | JSON API | No (may need proxy on server) |
| `social_doctor` | Diagnostics | — | No |

### Setup

```bash
# YouTube transcript extraction
pip install yt-dlp
# Requires Node.js or deno as JS runtime

# Twitter/X reading
npm install -g @steipete/bird
# Then configure cookies: export AUTH_TOKEN="..." CT0="..."

# Reddit — works from local machine, may need proxy on server IPs
# web_fetch / web_search — always available, no setup
```

Run `social_doctor` to check which tools are available on the current system.

### Tool Details

- **`youtube_transcript`**: Extracts video metadata (title, duration, views) and subtitle/transcript text. Supports `lang` parameter and `auto` captions. Falls back gracefully if no transcript available.
- **`twitter_read`**: Reads individual tweets/threads via bird CLI. Requires Twitter cookie authentication (`AUTH_TOKEN` and `CT0` env vars). Use Cookie-Editor Chrome extension to export.
- **`reddit_read`**: Reads posts with comments, subreddit listings, and subreddit search via Reddit's public JSON API. No auth needed. Returns structured content with scores, authors, and nested comments.
- **`social_doctor`**: One-command diagnostics showing which social tools are installed and working. Reports ok/warn/off status for each channel.

## Office Document Tools

Jim provides native tools for creating, reading, and modifying Office documents (inspired by [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)):

| Tool | Purpose |
|------|---------|
| `office` | Create, view, get, query, set, add, remove, move, validate, batch operations on .docx/.xlsx/.pptx |
| `office_doctor` | Diagnose OfficeCLI installation and capabilities |

### Setup

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash

# Windows
irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex

# Or download from: https://github.com/iOfficeAI/OfficeCLI/releases
```

### Usage

```json
// Create a PowerPoint
{ "command": "create", "file": "deck.pptx" }

// Add a slide with title
{ "command": "add", "file": "deck.pptx", "path": "/", "type": "slide", "props": "title=Q4 Report,background=1A1A2E" }

// Add text shape
{ "command": "add", "file": "deck.pptx", "path": "/slide[1]", "type": "shape", "props": "text=Revenue grew 25%,x=2cm,y=5cm,font=Arial,size=24,color=FFFFFF" }

// View outline
{ "command": "view", "file": "deck.pptx", "view_mode": "outline" }

// Get element by path
{ "command": "get", "file": "deck.pptx", "path": "/slide[1]/shape[1]", "json_output": true }

// Modify element
{ "command": "set", "file": "deck.pptx", "path": "/slide[1]/shape[1]", "props": "text=Updated text" }

// Validate document
{ "command": "validate", "file": "report.docx" }
```

### Commands Reference

| Command | Description | Key params |
|---------|-------------|------------|
| `create` | Create blank .docx/.xlsx/.pptx | file |
| `view` | View content (outline, text, stats, issues) | view_mode |
| `get` | Get element by path | path, depth |
| `query` | CSS-like selector query | path (as selector) |
| `set` | Modify element properties | path, props |
| `add` | Add element | path, type, props |
| `remove` | Remove element | path |
| `move` | Move element | path, to, index |
| `validate` | Validate against OpenXML schema | — |
| `batch` | Multiple ops in one cycle | props (JSON array) |

### Path Syntax

- **PowerPoint**: `/slide[1]/shape[1]` — 1-indexed slide and shape
- **Word**: `/body/p[1]/r[1]` — paragraph and run
- **Excel**: `/sheet[1]/cell[A1]` — sheet and cell reference

Run `office_doctor` to check if OfficeCLI is installed and working.

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

# Social media / internet
BRAVE_SEARCH_API_KEY=...      # Optional: Brave Search (otherwise DuckDuckGo)
FIRECRAWL_API_KEY=...         # Optional: Firecrawl (otherwise Jina Reader)
AUTH_TOKEN=...                # Twitter/X auth token (for bird CLI)
CT0=...                       # Twitter/X ct0 cookie (for bird CLI)
REDDIT_PROXY=...              # Optional: proxy for Reddit from server IPs
```
