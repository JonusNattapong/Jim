import type { ToolDefinition, ToolHandler } from "./types.js";

export const pin_context_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "pin_context",
    description: "Mark a message index or specific content as 'pinned' in Jim's memory. Pinned context is preserved during compaction (summarization) to maintain high-fidelity access to critical information like architectural decisions or pinned file contents.",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: "number",
          description: "Index of the message to pin in the current conversation (use 0 for initial setup, or leave empty if pinning recently provided content)."
        },
        path: {
          type: "string",
          description: "Path to a file whose content should be pinned in context. Jim will ensure this file stays in the active window during the session."
        },
        reason: {
          type: "string",
          description: "Reason for pinning this context (e.g. 'Core architectural rule', 'Active bug fix target')"
        }
      },
      required: ["reason"]
    }
  }
};

export const pin_context_handler: ToolHandler = async (args, context) => {
  try {
    // Note: The logic for actual message pinning is handled by the Agent loop and ContextManager.
    // This handler serves as a signal to the agent to perform the pinning.
    const reason = args.reason as string;
    const path = args.path as string | undefined;
    const index = args.index as number | undefined;

    return { 
      content: `Pin request processed: ${reason}${path ? ` for file ${path}` : ""}${index !== undefined ? ` at message ${index}` : ""}. I will ensure this remains in my high-fidelity context.`,
      metadata: { 
        pinned: true, 
        pinnedIndex: index, 
        pinnedPath: path 
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error pinning context: ${msg}`, isError: true };
  }
};
