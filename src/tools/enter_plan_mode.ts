import type { ToolDefinition, ToolHandler } from "./types.js";
import type { PlanManager } from "../agent/plan-manager.js";

export const enter_plan_mode_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "enter_plan_mode",
    description:
      "Enter plan mode for complex tasks requiring exploration and design. " +
      "In plan mode, the agent focuses on read-only exploration and planning before implementation. " +
      "Use this when facing a complex task that needs careful consideration of approaches.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Brief explanation of why plan mode is needed (optional)",
        },
      },
      required: [],
    },
  },
};

export const enter_plan_mode_handler: ToolHandler = async (args) => {
  try {
    const manager = getPlanManager();
    const result = await manager.enterPlanMode();

    return {
      content: result.message,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error entering plan mode: ${msg}`, isError: true };
  }
};

// Global plan manager instance
let globalPlanManager: PlanManager | null = null;

export function setPlanManager(manager: PlanManager): void {
  globalPlanManager = manager;
}

export function getPlanManager(): PlanManager {
  if (!globalPlanManager) {
    throw new Error("Plan manager not initialized. Call setPlanManager first.");
  }
  return globalPlanManager;
}
