import type { ToolDefinition, ToolHandler } from "./types.js";

export const ask_user_choice_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "ask_user_choice",
    description:
      "Ask the user to choose from a short list of options. " +
      "Use when there are meaningful tradeoffs such as quick fix vs refactor, " +
      "which mode to use, whether to inspect more deeply, or which session/checkpoint to restore.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Short question shown to the user.",
        },
        choices: {
          type: "string",
          description:
            "JSON array of 2-5 options. " +
            "Each option: {label: string, value: string, description?: string}.",
        },
      },
      required: ["prompt", "choices"],
    },
  },
};

export const ask_user_choice_handler: ToolHandler = async () => ({
  content: "ask_user_choice is handled by the agent loop directly.",
  isError: false,
});
