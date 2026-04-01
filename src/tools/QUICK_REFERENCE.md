# Tool Enhancement System - Quick Reference

## 📂 What's New?

Jim's tools now have a complete enhancement system inspired by Claude Code's architecture:

### 1️⃣ **Prompts** - Usage Guidance
```typescript
import { getToolPrompt } from "./prompts/index.js";
const prompt = getToolPrompt("grep");
// Returns: { name, description, systemPrompt, tips, commonMistakes }
```
**9 tools covered**: run_command, grep, read_file, edit_file, git_command, web_fetch, write_file, reflect, task_manage

### 2️⃣ **Semantics** - Exit Code Interpretation
```typescript
import { interpretExitCode } from "./semantics/index.js";
const result = interpretExitCode("grep", 1, "", "");
// { isError: false, message: "No matches found" }
// ← Exit code 1 from grep means "no match", NOT an error!
```
**Handles**: grep/rg (exit 1 = no match), find (exit 1 = partial), git, default

### 3️⃣ **Validation** - Safety Checks
```typescript
import { validateCommand, requiresApproval } from "./validation/index.js";
validateCommand("rm -rf /");
// { valid: false, error: "dangerous pattern", suggestion: "..." }

requiresApproval("npm install");
// true → Command modifies system, needs approval
```
**Validates**: Dangerous patterns, file paths, regex syntax, command approval

### 4️⃣ **Errors** - Helpful Messages
```typescript
import { formatErrorWithSuggestion, TOOL_ERRORS } from "./errors/index.js";
const error = TOOL_ERRORS.FILE_NOT_FOUND;
console.log(formatErrorWithSuggestion(error));
// **File or directory not found** (FILE_NOT_FOUND)
// The specified file or directory does not exist
// 💡 Use grep or list_files to find the correct path...
```
**12+ errors**: FILE_NOT_FOUND, COMMAND_TIMEOUT, NO_MATCHES_FOUND, etc.

---

## 🚀 Common Tasks

### Get tool usage tips
```typescript
import { getToolTips } from "./prompts/index.js";
const tips = getToolTips("grep");
// "💡 Tips:\n- Always grep BEFORE reading files...\n- Use case_insensitive=true..."
```

### Check if command is dangerous
```typescript
import { validateCommand } from "./validation/index.js";
const { valid, error, suggestion } = validateCommand(userCommand);
if (!valid) showError(error, suggestion);
```

### Interpret command result
```typescript
import { interpretExitCode } from "./semantics/index.js";
const semantic = interpretExitCode(cmd, exitCode, stdout, stderr);
if (semantic.isError) {
  // Real error
} else if (semantic.message) {
  // Info message (e.g., "No matches found")
}
```

### Format error for user
```typescript
import { formatErrorWithSuggestion } from "./errors/index.js";
const formatted = formatErrorWithSuggestion(toolError);
// Include in result message for actionable feedback
```

---

## 📍 File Locations

```
src/tools/
├── prompts/
│   └── tool-prompts.ts          ← Add/update tool guidance
├── semantics/
│   └── command-semantics.ts     ← Add command-specific exit codes
├── validation/
│   └── tool-validation.ts       ← Add validation rules
├── errors/
│   └── error-catalogue.ts       ← Add error definitions
├── ENHANCEMENTS.md              ← Full documentation
├── EXAMPLE_INTEGRATION.ts       ← Before/after examples
├── types.ts                     ← Enhanced with EnhancedToolDefinition
└── __tests__/
    └── enhancements.test.ts     ← Test suite (16 tests, all passing)
```

---

## 🔄 Integrating Into a Tool

```typescript
// 1. Import the systems
import { validateCommand } from "./validation/index.js";
import { interpretExitCode } from "./semantics/index.js";

// 2. Validate input
const validation = validateCommand(args.command);
if (!validation.valid) {
  return { content: validation.error, isError: true };
}

// 3. Execute
const result = await execute(args.command);

// 4. Interpret exit code
const semantic = interpretExitCode(args.command, result.exitCode, result.stdout, result.stderr);
if (!semantic.isError && semantic.message) {
  result.content = `${semantic.message}\n${result.content}`;
}

return result;
```

---

## 🧪 Testing

```bash
# Run all enhancement tests
pnpm test src/tools/__tests__/enhancements.test.ts

# Test specific area
pnpm test enhancements.test.ts -t "Validation"

# Run with coverage
pnpm test:coverage src/tools/__tests__/enhancements.test.ts
```

**Current Status**: ✅ 16/16 tests passing

---

## 📚 Examples

### Example 1: Grep no-match scenario
```
Command: grep "nonexistent" file.txt
Exit code: 1 (means "no match" in grep)
Before: ❌ Reported as error
After: ✅ { isError: false, message: "No matches found" }
```

### Example 2: Dangerous command detection
```
Command: rm -rf /
Validation: { valid: false, error: "dangerous pattern", suggestion: "..." }
Result: ❌ Blocked before execution
```

### Example 3: Approval flagging
```
Command: npm install new-package
requiresApproval: true
Action: ⚠️ Flag for user approval before executing
```

### Example 4: Error with suggestion
```
Error: FILE_NOT_FOUND
Formatted: **File or directory not found**
           💡 Use grep or list_files to find the correct path
```

---

## 🎯 Next Steps

### Phase 1: Update Core Tools
- [ ] Update `run_command_handler` with validation + semantics
- [ ] Update `grep_handler` with command semantics
- [ ] Update `read_file_handler` with path validation
- [ ] Add tests for enhanced handlers

### Phase 2: Inject Into Agent
- [ ] Add tool prompts to system prompt in `src/agent/prompt.ts`
- [ ] Test agent behavior with new guidance

### Phase 3: Extend Coverage
- [ ] Add more tool prompts (browser_action, task_manage, etc.)
- [ ] Extend error catalogue with domain-specific errors
- [ ] Add validation for additional tool types

---

## ❓ FAQ

**Q: How do I add a new tool with enhancements?**
A: Create the tool handler, add entry to each module (prompts, errors, validation, semantics). See ENHANCEMENTS.md.

**Q: When should I use interpretExitCode?**
A: Whenever your tool runs a command (grep, find, git, etc.). It ensures exit codes are interpreted correctly.

**Q: How do I add a new error?**
A: Add entry to `TOOL_ERRORS` in `src/tools/errors/error-catalogue.ts` with code, title, message, suggestion.

**Q: Can I use these independently?**
A: Yes! Each module (prompts, semantics, validation, errors) can be used separately or together.

**Q: Will this break existing tools?**
A: No! The enhancement system is additive. Existing tools work unchanged. You integrate gradually.

---

## 📖 Read More

- **Full Guide**: [ENHANCEMENTS.md](./ENHANCEMENTS.md)
- **Integration Example**: [EXAMPLE_INTEGRATION.ts](./EXAMPLE_INTEGRATION.ts)
- **Test Suite**: [enhancements.test.ts](./__tests__/enhancements.test.ts)

---

**Built by learning from Claude Code's tools architecture** 🎓
