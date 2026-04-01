# Tool Enhancement System

This directory contains Jim's enhanced tool system for better guidance, error handling, validation, and semantics interpretation.

## Overview

The tool enhancement system consists of 4 components:

### 1. **Prompts** (`prompts/`)
Tool-specific system prompt templates that teach the agent how to use each tool effectively.

- **Location**: `src/tools/prompts/tool-prompts.ts`
- **What it does**: Provides usage guidelines, tips, and common mistakes for each tool
- **Use case**: Inject into system prompt when building agent context

```typescript
import { getToolPrompt, buildToolPromptsSection } from "./prompts/index.js";

const prompt = getToolPrompt("grep");
console.log(prompt.systemPrompt); // Usage guidance for grep

const fullSection = buildToolPromptsSection(); // All tool prompts
```

### 2. **Semantics** (`semantics/`)
Command exit code interpretation for tools like `grep`, `rg`, `find`, `git`.

- **Location**: `src/tools/semantics/command-semantics.ts`
- **What it does**: Maps exit codes to meaningful messages (exit code 1 from grep = "no matches", not an error)
- **Use case**: Properly interpret command results

```typescript
import { interpretExitCode } from "./semantics/index.js";

// Exit code 1 from grep is not an error, it's "no matches"
const result = interpretExitCode("grep", 1, "", "");
console.log(result); // { isError: false, message: "No matches found" }
```

### 3. **Validation** (`validation/`)
Pre-execution validation for commands and arguments.

- **Location**: `src/tools/validation/tool-validation.ts`
- **What it does**: Detects dangerous commands, validates file paths, regex patterns, and arguments
- **Use case**: Safety checks before executing tools

```typescript
import { validateCommand, requiresApproval } from "./validation/index.js";

const cmd = "rm -rf /";
const validation = validateCommand(cmd);
console.log(validation); // { valid: false, error: "Command matches dangerous pattern" }

if (requiresApproval("npm install")) {
  // Request user approval first
}
```

### 4. **Errors** (`errors/`)
Centralized error catalogue with actionable suggestions.

- **Location**: `src/tools/errors/error-catalogue.ts`
- **What it does**: Defines common tool errors with explanations and solutions
- **Use case**: Format errors with helpful suggestions

```typescript
import { formatErrorWithSuggestion, TOOL_ERRORS } from "./errors/index.js";

const error = TOOL_ERRORS.FILE_NOT_FOUND;
console.log(formatErrorWithSuggestion(error));
// Outputs: File not found
//   **File or directory not found** (FILE_NOT_FOUND)
//   The specified file or directory does not exist
//   💡 Use grep or list_files to find the correct path...
```

## Integration Guide

### How to Use in Existing Tools

Update a tool handler to use the enhancement system:

```typescript
// Before: Simple error handling
export const run_command_handler: ToolHandler = async (args) => {
  const result = await sandboxedExec(args.command);
  return result;
};

// After: Enhanced validation and semantics
export const run_command_handler: ToolHandler = async (args) => {
  // 1. Validate command
  const validation = validateCommand(args.command);
  if (!validation.valid) {
    return {
      content: `Error: ${validation.error}\n${validation.suggestion}`,
      isError: true,
    };
  }

  // 2. Execute
  const result = await sandboxedExec(args.command);

  // 3. Interpret exit code with semantics
  if (result.metadata?.exitCode !== undefined) {
    const semantic = interpretExitCode(
      args.command,
      result.metadata.exitCode,
      result.content,
      result.metadata?.stderr || "",
    );

    if (!semantic.isError && semantic.message) {
      result.content = `${semantic.message}\n${result.content}`;
    } else if (semantic.isError) {
      result.isError = true;
    }
  }

  return result;
};
```

### How to Inject Prompts into Agent System Prompt

```typescript
import { buildToolPromptsSection } from "./src/tools/prompts/index.js";

// In your system prompt builder
export function buildAgentSystemPrompt(): string {
  const basePrompt = "You are Jim, an AI coding agent...";

  // Add tool guidance
  const toolGuidance = buildToolPromptsSection();

  return basePrompt + "\n\n" + toolGuidance;
}
```

### How to Add a New Tool with Enhancements

1. **Create the tool handler** in `src/tools/your-tool.ts`
2. **Add a prompt template** in `src/tools/prompts/tool-prompts.ts`
3. **Add error codes** in `src/tools/errors/error-catalogue.ts` if needed
4. **Add validation rules** in `src/tools/validation/tool-validation.ts` if needed
5. **Add command semantics** in `src/tools/semantics/command-semantics.ts` if it's a shell command

Example adding `deploy` tool:

```typescript
// src/tools/deploy.ts
import { validateCommand } from "./validation/index.js";

export const deploy_handler: ToolHandler = async (args) => {
  const validation = validateCommand(`deploy ${args.env}`);
  if (!validation.valid) {
    return { content: validation.error, isError: true };
  }
  // ... deployment logic
};

// src/tools/prompts/tool-prompts.ts - Add this entry:
deploy: {
  name: "deploy",
  description: "Deploy application to environment",
  systemPrompt: "Use deploy to push changes to staging or production...",
  tips: [
    "Always deploy to staging first",
    "Verify tests pass before deploying to production",
  ],
  commonMistakes: [
    "Deploying without running tests",
    "Deploying to production without approval",
  ],
} as ToolPrompt;
```

## File Structure

```
src/tools/
├── prompts/
│   ├── index.ts                    # Exports
│   └── tool-prompts.ts             # Tool-specific guidance
├── semantics/
│   ├── index.ts                    # Exports
│   └── command-semantics.ts        # Exit code interpretation
├── validation/
│   ├── index.ts                    # Exports
│   └── tool-validation.ts          # Command/arg validation
├── errors/
│   ├── index.ts                    # Exports
│   └── error-catalogue.ts          # Error definitions
├── enhancements.ts                 # Integration examples
├── types.ts                        # Enhanced with new types
└── ... (existing tool files)
```

## Current Tool Coverage

### Tools with Prompts ✅
- `run_command` - Shell execution
- `grep` - Text search
- `read_file` - File reading
- `edit_file` - File editing
- `git_command` - Git operations
- `web_fetch` - Web requests
- `write_file` - File creation
- `reflect` - Self-critique
- `task_manage` - Task tracking

### Tools with Command Semantics ✅
- `rg` (ripgrep) - Exit code 1 = no match
- `grep` - Exit code 1 = no match
- `find` - Exit code 1 = partial success
- `git` - Exit codes vary

### Tools with Validation ✅
- `run_command` - Dangerous pattern detection
- `read_file` - Path validation
- `grep` - Regex validation

## Next Steps for Integration

1. **Update `run_command_handler`** to use `validateCommand` and `interpretExitCode`
2. **Update `grep_handler`** to use command semantics
3. **Update `read_file_handler`** to use path validation
4. **Inject tool prompts** into agent system prompt in `src/agent/prompt.ts`
5. **Update error handling** across all tools to use `TOOL_ERRORS`

## Benefits

✅ **Better Guidance**: Agents understand tool usage better
✅ **Clearer Errors**: Error messages include actionable suggestions
✅ **Proper Exit Code Handling**: Commands interpreted correctly
✅ **Safety**: Dangerous operations detected and flagged
✅ **Consistency**: Unified error and guidance system
✅ **Maintainability**: Centralized tool knowledge

## Example: Refactoring run_command

See `src/tools/enhancements.ts` for a before/after example of how to integrate all four components.
