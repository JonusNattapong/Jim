import type { ToolDefinition, ToolHandler } from "./types.js";
import { sandboxedExec } from "./sandbox.js";

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

  return sandboxedExec(command, {
    timeout,
    projectRoot: process.cwd(),
    __abortSignal: abortSignal,
  });
};
