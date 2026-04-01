import type { ToolDefinition, ToolHandler } from "./types.js";
import { getPlanManager } from "./enter_plan_mode.js";

export const exit_plan_mode_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "exit_plan_mode",
    description:
      "Exit plan mode and present a plan for approval. " +
      "Use this after completing exploration and designing an implementation approach. " +
      "The plan will be saved and presented for user approval before implementation begins.",
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description:
            "The implementation plan. Should include:\n" +
            "1. Summary of what was discovered during exploration\n" +
            "2. Proposed implementation approach with rationale\n" +
            "3. Step-by-step breakdown of changes\n" +
            "4. Any considerations or trade-offs\n" +
            "5. Files that will be modified\n" +
            "6. Testing approach",
        },
        title: {
          type: "string",
          description: "A short title for this plan (optional)",
        },
        allowedPrompts: {
          type: "array",
          description:
            "Categories of actions that will be needed to implement the plan. " +
            "These describe what the agent is permitted to do.",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "Category of action, e.g., 'run tests', 'install dependencies', 'edit files'",
              },
              scope: {
                type: "string",
                description: "Scope of the action, e.g., 'specific test files', 'any dependency'",
              },
            },
            required: ["action"],
          },
        },
      },
      required: ["plan"],
    },
  },
};

export const exit_plan_mode_handler: ToolHandler = async (args) => {
  try {
    const manager = getPlanManager();
    const result = await manager.exitPlanMode(args.plan as string, args.title as string | undefined);

    if (!result.success) {
      return { content: `Error: ${result.message}`, isError: true };
    }

    let content = `✓ ${result.message}\n\n`;
    content += `**Plan Title:** ${result.plan?.title}\n`;
    content += `**Plan ID:** ${result.plan?.id}\n`;
    content += `**File:** ${result.filePath}\n\n`;

    if (result.plan?.steps && result.plan.steps.length > 0) {
      content += "**Steps identified:**\n";
      for (const step of result.plan.steps) {
        content += `  ${step.id.replace("step-", "")}. ${step.description}\n`;
      }
      content += "\n";
    }

    if (args.allowedPrompts && Array.isArray(args.allowedPrompts) && args.allowedPrompts.length > 0) {
      content += "**Approved actions for this plan:**\n";
      for (const prompt of args.allowedPrompts) {
        if (typeof prompt === "object" && prompt !== null) {
          const p = prompt as { action: string; scope?: string };
          content += `  • ${p.action}${p.scope ? `: ${p.scope}` : ""}\n`;
        }
      }
      content += "\n";
    }

    content += "The plan is now awaiting your approval. You can:\n";
    content += "  • Approve it to proceed with implementation\n";
    content += "  • Request modifications\n";
    content += "  • Reject it and provide feedback\n";

    return { content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error exiting plan mode: ${msg}`, isError: true };
  }
};
