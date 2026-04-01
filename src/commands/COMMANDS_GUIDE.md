# Jim Command System Enhancement Guide

## Overview

Jim's command system has been enhanced with patterns from Claude Code, providing:

- **Modular commands** - Organize complex commands in directories
- **Lazy loading** - Commands only load when needed
- **Enable/disable mechanism** - Context-aware command visibility
- **Rich metadata** - Better help text, argument hints, categories
- **Command types** - Support for local, JSX, and external commands
- **Backward compatibility** - Existing commands continue to work

## Command Types

### 1. **Local Commands** (`type: "local"`)
Simple text-based commands with a handler function.

```typescript
import type { EnhancedCommandDefinition } from "../types.js";

const myCommand = {
  type: "local",
  name: "mycommand",
  description: "Does something useful",
  argumentHint: "[action] [target]",
  category: "general",
  supportsNonInteractive: true,
  load: () => import("./mycommand.js"),
} satisfies EnhancedCommandDefinition;

export default myCommand;
```

### 2. **JSX Commands** (`type: "local-jsx"`)
React components for interactive CLIs.

```typescript
const mcp = {
  type: "local-jsx",
  name: "mcp",
  description: "Manage MCP servers",
  immediate: true,
  load: () => import("./mcp-ui.jsx"),
} satisfies EnhancedCommandDefinition;
```

### 3. **External Commands** (`type: "external"`)
Commands handled by external processes.

```typescript
const deploy = {
  type: "external",
  name: "deploy",
  description: "Deploy to production",
  isEnabled: async () => canDeploy(),
};
```

## Creating a Modular Command

### File Structure

```
src/commands/
├── mycommand/
│   ├── index.ts        # Command definition + metadata
│   └── mycommand.ts    # Handler implementation
├── types.ts
├── registry.ts
└── index.ts            # Main export
```

### Step 1: Create the definition (`index.ts`)

```typescript
// src/commands/mycommand/index.ts
import type { EnhancedCommandDefinition } from "../types.js";

const mycommand = {
  type: "local",
  name: "mycommand",
  description: "Brief description of what it does",
  argumentHint: "[arg1] [arg2]",  // Optional: for help text
  category: "general",             // git, config, model, etc.
  supportsNonInteractive: false,   // Optional: CLI support
  isEnabled: async () => true,      // Optional: context-aware enabling
  load: () => import("./mycommand.js"),
} satisfies EnhancedCommandDefinition;

export default mycommand;
```

### Step 2: Create the handler (`mycommand.ts`)

```typescript
// src/commands/mycommand/mycommand.ts
import type { LocalCommandCall } from "../types.js";

const call: LocalCommandCall = async (args, context) => {
  const [action, target] = args.trim().split(/\s+/);

  if (!action) {
    return {
      type: "text",
      value: "Usage: /mycommand [action] [target]",
    };
  }

  try {
    // Your logic here
    return {
      type: "text",
      value: `✅ Done: ${action} on ${target}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      type: "error",
      value: `Failed: ${msg}`,
    };
  }
};

export { call };
```

### Step 3: Register the command

In `src/commands/index.ts`, add:

```typescript
import mycommandCommand from "./mycommand/index.js";

export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  
  // Register your modular command
  registry.register(mycommandCommand);
  
  // ... rest of commands
  
  return registry;
}
```

## Advanced Features

### 1. Context-Aware Enabling

```typescript
const command = {
  type: "local",
  name: "deploy",
  isEnabled: async () => {
    // Check if deployment is available in current context
    return process.env.NODE_ENV === "production";
  },
};
```

### 2. Hidden Commands

```typescript
const debugCommand = {
  type: "local",
  name: "debug-internal",
  get isHidden() {
    return !process.env.DEBUG;  // Only show in debug mode
  },
};
```

### 3. Non-Interactive Support

```typescript
const command = {
  type: "local",
  name: "builds",
  supportsNonInteractive: true,  // Can run from scripts/CI
};
```

### 4. Lazy Loading

Commands are lazy-loaded via the `load()` function:

```typescript
load: () => import("./mycommand.js")  // Only imported when called
```

This reduces startup time for Jim.

## Command Result Format

All handlers return a `CommandResult`:

```typescript
interface CommandResult {
  type: "text" | "jsx" | "error";
  value: string | React.ReactNode;
}
```

### Text Result
```typescript
return {
  type: "text",
  value: "✅ Command executed successfully",
};
```

### Error Result
```typescript
return {
  type: "error",
  value: "Something went wrong",
};
```

### JSX Result (for interactive commands)
```typescript
return {
  type: "jsx",
  value: <MyComponent data={data} />,
};
```

## Command Categories

Available categories for organization:

- `git` - Git operations
- `context` - Context management
- `session` - Session management
- `config` - Configuration
- `model` - Model selection
- `mcp` - MCP server management
- `tools` - Tool management
- `skills` - Skills management
- `memory` - Memory operations
- `general` - General utilities

## Built-in Modular Commands

### `/model [model-name]`
Switch the current AI model with lazy loading.

### `/config [key] [value]`
View or modify configuration with better UX.

### `/mcp [list|enable|disable] [server-name]`
Manage MCP servers with rich output.

## Migration Guide: Old → New

### Old Command Format
```typescript
registry.register({
  name: "oldcmd",
  description: "An old command",
  usage: "/oldcmd [arg]",
  handler: async (args, ctx) => {
    return "Result";
  },
});
```

### New Format
Create `src/commands/oldcmd/index.ts`:
```typescript
import type { EnhancedCommandDefinition } from "../types.js";

const oldcmd = {
  type: "local",
  name: "oldcmd",
  description: "An old command",
  argumentHint: "[arg]",
  category: "general",
  load: () => import("./oldcmd.js"),
} satisfies EnhancedCommandDefinition;

export default oldcmd;
```

Create `src/commands/oldcmd/oldcmd.ts`:
```typescript
import type { LocalCommandCall } from "../types.js";

const call: LocalCommandCall = async (args, context) => {
  return {
    type: "text",
    value: "Result",
  };
};

export { call };
```

## Best Practices

1. **Use modular structure** for commands with >50 lines of code
2. **Leverage lazy loading** to keep startup times low
3. **Provide clear argumentHints** for CLI suggestions
4. **Use categories** for organizing related commands
5. **Implement isEnabled()** for context-aware commands
6. **Return structured CommandResult** objects, not raw strings
7. **Add error handling** with descriptive messages
8. **Test with /help** and `/cmd --help` options

## Examples

### Simple Command
See [`src/commands/model/`](src/commands/model/) for a simple model selection command.

### Complex Command
See [`src/commands/config/`](src/commands/config/) for configuration management.

### Multi-Action Command
See [`src/commands/mcp/`](src/commands/mcp/) for MCP server management.

## Backward Compatibility

Existing inline commands in `src/commands/index.ts` will continue to work. However, new commands should use the modular pattern for better maintainability.
