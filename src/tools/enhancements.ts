/**
 * Tool Enhancement Integration
 * Brings together prompts, semantics, validation, and errors
 * This is how to use the new tool enhancement system
 */

import { getToolPrompt } from "./prompts/tool-prompts.js";
import { getCommandSemantics, interpretExitCode } from "./semantics/command-semantics.js";
import { validateCommand, requiresApproval, sanitizeCommandForLogging } from "./validation/tool-validation.js";
import { TOOL_ERRORS, formatErrorWithSuggestion } from "./errors/error-catalogue.js";
import type { ToolResult } from "./types.js";

/**
 * Enhanced tool execution wrapper
 * This is how to use all the systems together
 */
export async function executeToolWithEnhancements(
  toolName: string,
  args: Record<string, any>,
  handler: (args: Record<string, any>) => Promise<ToolResult>,
): Promise<ToolResult> {
  // 1. Get tool-specific guidance
  const prompt = getToolPrompt(toolName);
  if (prompt) {
    console.debug(`Using ${toolName} with guidance from prompt system`);
  }

  // 2. Validation phase (if this is a command tool)
  if (toolName === "run_command" && args.command) {
    const validation = validateCommand(args.command);
    if (!validation.valid) {
      return {
        content: `❌ Command validation failed: ${validation.error}\n${validation.suggestion}`,
        isError: true,
      };
    }

    // 3. Check if approval required
    if (requiresApproval(args.command)) {
      console.warn(`⚠️ Command requires approval: ${sanitizeCommandForLogging(args.command)}`);
      // In real implementation, would request user approval here
    }
  }

  // 4. Execute the tool
  const result = await handler(args);

  // 5. If command-based tool, interpret exit code with semantics
  if (toolName === "run_command" && args.command && result.metadata?.exitCode !== undefined) {
    const semantics = getCommandSemantics(args.command);
    const interpretation = interpretExitCode(args.command, result.metadata.exitCode, result.content, "");

    if (interpretation.message) {
      result.content = `${interpretation.message}\n${result.content}`;
    }
  }

  return result;
}

/**
 * Format tool error with enhancement system
 * Shows error + suggestion + examples
 */
export function formatToolErrorEnhanced(errorCode: string, context?: string): string {
  const toolError = Object.values(TOOL_ERRORS).find((e) => e.code === errorCode);

  if (!toolError) {
    return `Unknown error: ${errorCode}`;
  }

  let result = formatErrorWithSuggestion(toolError);

  if (context) {
    result += `\n\n📍 Context: ${context}`;
  }

  return result;
}

/**
 * Example: How grep tool should use the enhancement system
 */
export function exampleGrepEnhanced(pattern: string, path: string): string {
  const prompt = getToolPrompt("grep");

  if (!prompt) {
    return "Prompt not found for grep";
  }

  // Show guidance to the user/LLM
  const guidance = `
## Using grep tool

${prompt.systemPrompt}

${prompt.tips.map((tip) => `- ${tip}`).join("\n")}

Running: grep pattern=${pattern} path=${path}
`;

  return guidance;
}

/**
 * Example: How to handle grep errors with enhancement
 */
export function exampleGrepError(exitCode: number): string {
  const semantics = getCommandSemantics("rg");
  const interpretation = semantics(exitCode, "", "");

  if (interpretation.isError) {
    return formatToolErrorEnhanced("NO_MATCHES_FOUND", "Pattern has no matches in the specified path");
  }

  return "Grep succeeded";
}

/**
 * Inject tool prompts into system prompt
 * Call this when building agent system prompt
 */
export function injectToolPromptsIntoSystemPrompt(basePrompt: string): string {
  const toolPromptsWithGuidance = Object.values({ getToolPrompt })
    .map(() => "")
    .join("");

  return (
    basePrompt +
    "\n\n## Tool Usage Enhancement System\n" +
    "The following tools have been enhanced with:" +
    "\n- Tool-specific usage guidance" +
    "\n- Error catalogues with actionable suggestions" +
    "\n- Command semantics for proper exit code interpretation" +
    "\n- Validation rules for safety\n"
  );
}
