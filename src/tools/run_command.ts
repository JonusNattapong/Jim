import type { ToolDefinition, ToolHandler } from "./types.js";
import { sandboxedExec } from "./sandbox.js";
import { validateCommand, requiresApproval } from "./validation/tool-validation.js";
import { getCommandSemantics } from "./semantics/command-semantics.js";
import { getToolError } from "./errors/error-catalogue.js";

export const run_command_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "run_command",
    description:
      "Execute a shell command (sandboxed if Docker available). " +
      "Use for running tests, building, git operations, installing deps, etc. " +
      "Output is truncated to 5000 chars. Dangerous commands require user approval.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute",
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds (default: 30)",
        },
      },
      required: ["command"],
    },
  },
};

export const run_command_handler: ToolHandler = async (args) => {
  const command = args.command as string;
  const timeout = args.timeout as number | undefined;
  const abortSignal = (args as any).__abortSignal as AbortSignal | undefined;

  // Validate command safety
  const validation = validateCommand(command);
  if (!validation.valid) {
    const error = getToolError("COMMAND_VALIDATION_FAILED");
    return {
      content: `${error.title}\n\n${validation.error}\n\n${validation.suggestion}`,
      isError: true,
    };
  }

  // Check if command requires user approval
  if (requiresApproval(command)) {
    return {
      content: `This command requires explicit user approval:\n\n${command}\n\nPlease confirm this action.`,
      isError: true,
    };
  }

  try {
    const result = await sandboxedExec(command, {
      timeout,
      projectRoot: process.cwd(),
      __abortSignal: abortSignal,
    });

    // If command failed, try to interpret exit code using command semantics
    if (result.isError && result.content) {
      const commandName = command.split(/\s+/)[0];
      const semantics = getCommandSemantics(commandName);
      
      if (semantics) {
        // Extract exit code from error message if present
        const exitCodeMatch = result.content.match(/exit (\d+)/);
        if (exitCodeMatch) {
          const exitCode = parseInt(exitCodeMatch[1], 10);
          const interpreted = semantics(exitCode, result.content, "");
          if (!interpreted.isError) {
            // This exit code doesn't actually represent an error
            return {
              content: interpreted.message || result.content,
              isError: false,
            };
          }
        }
      }
    }

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    
    // Try to categorize the error
    if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
      const error = getToolError("COMMAND_TIMEOUT");
      return {
        content: `${error.title}\n\n${error.message}\n\n${error.suggestion}`,
        isError: true,
      };
    }
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      const error = getToolError("COMMAND_NOT_FOUND");
      return {
        content: `${error.title}\n\n${error.message}\n\n${error.suggestion}`,
        isError: true,
      };
    }

    return { content: `Command error: ${msg}`, isError: true };
  }
};
