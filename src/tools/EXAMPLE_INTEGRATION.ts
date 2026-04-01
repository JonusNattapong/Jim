/**
 * EXAMPLE: How to refactor run_command to use the Enhancement System
 * This shows the before/after of integrating all four enhancement modules
 */

import type { ToolHandler } from "./types.js";
import { sandboxedExec } from "./sandbox.js";
import { validateCommand, requiresApproval, sanitizeCommandForLogging } from "./validation/index.js";
import { interpretExitCode } from "./semantics/index.js";
import { TOOL_ERRORS } from "./errors/index.js";

// ============================================================================
// BEFORE: Current run_command implementation (simplified)
// ============================================================================

export const run_command_handler_before: ToolHandler = async (args) => {
  const command = args.command as string;
  const timeout = args.timeout as number | undefined;

  const abortSignal = (args as any).__abortSignal as AbortSignal | undefined;

  return sandboxedExec(command, {
    timeout,
    projectRoot: process.cwd(),
    __abortSignal: abortSignal,
  });
};

// ============================================================================
// AFTER: Enhanced run_command implementation
// ============================================================================

export const run_command_handler_after: ToolHandler = async (args) => {
  const command = args.command as string;
  const timeout = args.timeout as number | undefined;
  const abortSignal = (args as any).__abortSignal as AbortSignal | undefined;

  // ========================================================================
  // STEP 1: VALIDATION - Check for dangerous patterns
  // ========================================================================
  const validation = validateCommand(command);
  if (!validation.valid) {
    return {
      content: `❌ **Command validation failed**\n\n${validation.error}\n\n💡 ${validation.suggestion}`,
      isError: true,
    };
  }

  // ========================================================================
  // STEP 2: APPROVAL CHECK - Flag commands that need approval
  // ========================================================================
  if (requiresApproval(command)) {
    console.warn(`⚠️ Command requires user approval: ${sanitizeCommandForLogging(command)}`);
    // In production, would request user confirmation here
    // For now, we proceed but log the warning
  }

  // ========================================================================
  // STEP 3: EXECUTE - Run the command
  // ========================================================================
  const result = await sandboxedExec(command, {
    timeout,
    projectRoot: process.cwd(),
    __abortSignal: abortSignal,
  });

  // ========================================================================
  // STEP 4: SEMANTICS - Interpret exit codes correctly
  // ========================================================================
  if (result.metadata?.exitCode !== undefined) {
    const semantic = interpretExitCode(
      command,
      result.metadata.exitCode,
      result.content,
      result.metadata?.stderr || "",
    );

    // If semantics says this isn't an error, override the error flag
    if (!semantic.isError && result.isError) {
      result.isError = false;
    }

    // If there's a semantic message, prepend it
    if (semantic.message) {
      result.content = `ℹ️ ${semantic.message}\n\n${result.content}`;
    }

    // If command-specific error, mark as error and add context
    if (semantic.isError && !result.isError) {
      result.isError = true;
      result.content = `❌ ${semantic.message}\n\n${result.content}`;
    }
  }

  return result;
};

// ============================================================================
// COMPARISON TABLE
// ============================================================================

/*
 * ENHANCEMENT SYSTEM BENEFITS:
 *
 * Feature                    | Before          | After
 * ---|---|---
 * Dangerous command check    | ❌ None        | ✅ Validates patterns
 * Approval flagging          | ❌ None        | ✅ Detects modifying ops
 * Exit code semantics        | ❌ Generic     | ✅ Command-specific
 * Input sanitization         | ❌ None        | ✅ Removes secrets
 * Error messages             | ❌ Generic     | ✅ Actionable with context
 * Common mistakes prevented  | ❌ None        | ✅ Pattern matching
 *
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 */

// Example 1: Dangerous command is caught
// Command: "rm -rf /"
// Before: Executes immediately (dangerous!)
// After: ✅ Blocked with validation error
const example1_bad_command = "rm -rf /";
// validateCommand(example1_bad_command) returns:
// { valid: false, error: "Command matches dangerous pattern", suggestion: "..." }

// Example 2: Exit code 1 from grep is correctly interpreted
// Command: "grep 'nonexistent' file.txt"
// Exit code: 1 (means "no match" in grep)
// Before: ❌ Reported as error
// After: ✅ Correctly interpreted as "No matches found" (isError: false)
const example2_grep = "grep";
// interpretExitCode("grep", 1, "", "") returns:
// { isError: false, message: "No matches found" }

// Example 3: Commands that modify state are flagged
// Command: "npm install new-package"
// Before: ❌ No warning
// After: ✅ Approval flag set, warning logged
const example3_modify = "npm install new-package";
// requiresApproval(example3_modify) returns: true

// Example 4: Secrets are removed from logs
// Command: 'curl -H "Authorization: Bearer sk-secret123" ...'
// Before: Secret exposed in logs
// After: ✅ Secret replaced with ***
const example4_secret = 'curl -H "Authorization: Bearer sk-secret123"';
// sanitizeCommandForLogging(example4_secret) returns:
// 'curl -H "Authorization: Bearer ***"'

// ============================================================================
// HOW TO INTEGRATE INTO EXISTING CODEBASE
// ============================================================================

/**
 * MIGRATION STEPS:
 *
 * 1. Import the enhancement modules at top of run_command.ts:
 *    ```
 *    import { validateCommand, sanitizeCommandForLogging } from "./validation/index.js";
 *    import { interpretExitCode } from "./semantics/index.js";
 *    ```
 *
 * 2. Replace run_command_handler with run_command_handler_after above
 *
 * 3. Update sandboxedExec to return metadata with exitCode
 *
 * 4. Test with: pnpm test run_command.test.ts
 *
 * 5. Repeat for grep_handler, git_command_handler, etc.
 *
 * 6. Add tool prompts to system prompt builder in src/agent/prompt.ts:
 *    ```
 *    import { buildToolPromptsSection } from "./tools/prompts/index.js";
 *    const toolGuidance = buildToolPromptsSection();
 *    ```
 *
 * ============================================================================
 * TESTING THE INTEGRATION
 * ============================================================================
 *
 * Test case 1: Dangerous command is rejected
 * ```typescript
 * const result = await run_command_handler_after({
 *   command: "rm -rf /important/data"
 * });
 * expect(result.isError).toBe(true);
 * expect(result.content).toContain("dangerous pattern");
 * ```
 *
 * Test case 2: Grep no-match is interpreted correctly
 * ```typescript
 * const result = await run_command_handler_after({
 *   command: "grep 'nonexistent' file.txt"
 * });
 * // Mock process to return exitCode: 1
 * expect(result.isError).toBe(false); // Not an error!
 * expect(result.content).toContain("No matches found");
 * ```
 *
 * Test case 3: Approval is flagged
 * ```typescript
 * const consoleSpy = vi.spyOn(console, 'warn');
 * await run_command_handler_after({ command: "npm install pkg" });
 * expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("approval"));
 * ```
 */

export type {
  ValidationResult,
  CommandValidationRules,
} from "./validation/tool-validation.js";
export type { ExitCodeSemantics } from "./semantics/command-semantics.js";
