import type { ToolDefinition, ToolHandler } from "./types.js";
import { activeProcesses } from "./sandbox.js";

export const send_command_input_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "send_command_input",
    description:
      "Send standard input (stdin) to a running shell command. " +
      "Use this to respond to interactive prompts (y/n, passwords, etc.). " +
      "Requires a 'processId' from a previous 'run_command' result.",
    parameters: {
      type: "object",
      properties: {
        processId: {
          type: "string",
          description: "The unique ID of the running process",
        },
        input: {
          type: "string",
          description: "The text to send to stdin (usually should end with \\n)",
        },
      },
      required: ["processId", "input"],
    },
  },
};

export const send_command_input_handler: ToolHandler = async (args) => {
  const processId = args.processId as string;
  const input = args.input as string;

  const child = activeProcesses.get(processId);
  if (!child) {
    return { content: `Error: No active process found with ID ${processId}. It may have already exited.`, isError: true };
  }

  if (child.stdin?.writable) {
    child.stdin.write(input);
    return { content: `Successfully sent input to process ${processId}.` };
  } else {
    return { content: `Error: Stdin of process ${processId} is not writable.`, isError: true };
  }
};
