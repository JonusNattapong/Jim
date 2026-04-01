import type { EnhancedCommandDefinition } from "../types.js";
import { cost_handler } from "./cost.js";

export const cost_command: EnhancedCommandDefinition = {
  type: "local",
  name: "cost",
  help: "Display current session cost tracking and budget information",
  description:
    "Shows how much money has been spent on API calls and token usage in the current session. Supports setting budget limits and viewing cost breakdown by model or provider.",
  argumentHint: "[reset|set-budget <amount>]",
  category: "system",
  handler: cost_handler,
};
