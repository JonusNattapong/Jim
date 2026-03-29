import type { ToolDefinition, ToolHandler } from "./types.js";

export const spawn_agent_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "spawn_agent",
    description:
      "Spawn a sub-agent or a team of agents. Available modes:\n\n" +
      "SINGLE AGENT (type = one of these roles):\n" +
      "- 'explore': Search and understand code (read-only, fast)\n" +
      "- 'general': Delegate a complete sub-task (full access)\n" +
      "- 'planner': Break down a complex task into steps (read-only)\n" +
      "- 'executor': Execute a specific task with full access\n" +
      "- 'reviewer': Review code changes for issues (read-only)\n" +
      "- 'web_surfer': Look up documentation/APIs on the web\n\n" +
      "TEAM MODE (type = 'team'):\n" +
      "- 'team-dev': Full dev team - PM plans, 2 Devs implement in parallel, QA reviews\n" +
      "- 'team-research': Research team - Researcher finds info, Writer creates, Editor polishes\n" +
      "  In team mode, set prompt = the overall task for the team.\n\n" +
      "PARALLEL MODE (type = 'parallel'):\n" +
      "  Spawn multiple agents of the same role working on different sub-tasks simultaneously.\n" +
      "  Set prompt = JSON array of task strings, one per agent.\n" +
      "  Example: type='executor', prompt='[\"Create user.ts\", \"Create auth.ts\", \"Create config.ts\"]'\n\n" +
      "Sub-agents save your context tokens. Teams enable PM→Dev→QA workflows with parallel execution.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["explore", "general", "planner", "executor", "reviewer", "web_surfer", "team-dev", "team-research", "parallel"],
          description: "Agent type or team mode",
        },
        prompt: {
          type: "string",
          description: "Task description. For 'parallel' type, provide a JSON array of task strings.",
        },
        context: {
          type: "string",
          description: "Optional context to inject (e.g. a plan for the executor, or code to review).",
        },
      },
      required: ["type", "prompt"],
    },
  },
};

// This is handled in the agent loop (loop.ts)
export const spawn_agent_handler: ToolHandler = async (_args) => {
  return {
    content: "spawn_agent is handled by the agent loop directly.",
    isError: false,
  };
};
