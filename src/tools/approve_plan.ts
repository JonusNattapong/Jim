import type { ToolDefinition, ToolHandler } from "./types.js";
import { getPlanManager } from "./enter_plan_mode.js";

export const approve_plan_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "approve_plan",
    description:
      "Approve the current plan for implementation. " +
      "This grants permission to proceed with the proposed implementation approach.",
    parameters: {
      type: "object",
      properties: {
        planId: {
          type: "string",
          description: "The ID of the plan to approve (optional, uses current plan if not specified)",
        },
        feedback: {
          type: "string",
          description: "Optional feedback or modifications to the plan",
        },
      },
      required: [],
    },
  },
};

export const approve_plan_handler: ToolHandler = async (args) => {
  try {
    const manager = getPlanManager();
    const result = await manager.approvePlan(args.planId as string | undefined);

    if (!result.success) {
      return { content: `Error: ${result.message}`, isError: true };
    }

    let content = `✓ ${result.message}\n\n`;
    content += "The agent is now authorized to proceed with implementation according to the approved plan.\n";
    content += "You can use /compact to reset context if needed before implementation begins.";

    return { content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error approving plan: ${msg}`, isError: true };
  }
};

export const reject_plan_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "reject_plan",
    description:
      "Reject the current plan and provide feedback for revisions. " +
      "Use this when the proposed approach needs significant changes or a different strategy.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Explanation of why the plan is being rejected and what needs to change",
        },
      },
      required: ["reason"],
    },
  },
};

export const reject_plan_handler: ToolHandler = async (args) => {
  try {
    const manager = getPlanManager();
    const result = await manager.rejectPlan(args.reason as string);

    if (!result.success) {
      return { content: `Error: ${result.message}`, isError: true };
    }

    return {
      content:
        `✗ ${result.message}\n\n` +
        "The agent will remain in the current state. You can:\n" +
        "  • Request the agent to enter plan mode again\n" +
        "  • Provide specific guidance on a different approach\n" +
        "  • Direct the agent to implement an alternative solution",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error rejecting plan: ${msg}`, isError: true };
  }
};
