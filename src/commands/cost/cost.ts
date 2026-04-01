import type { CommandHandler } from "../types.js";
import { getCostTracker, resetCostTracker } from "../../coordinator/cost-tracker.js";

export const cost_handler: CommandHandler = async (args) => {
  const tracker = getCostTracker();
  const command = (args as string | string[])?.[0] || "show";

  if (command === "reset") {
    resetCostTracker();
    return {
      type: "text",
      value: "✅ Cost tracker has been reset",
    };
  }

  if (command === "set-budget") {
    const amount = parseFloat((args as string[])?.[1] || "0");
    if (isNaN(amount) || amount <= 0) {
      return {
        type: "text",
        value: "❌ Invalid budget amount. Usage: /cost set-budget <amount>",
      };
    }
    tracker.setBudget(amount);
    return {
      type: "text",
      value: `✅ Budget set to $${amount.toFixed(2)}`,
    };
  }

  if (command === "set-threshold") {
    const amount = parseFloat((args as string[])?.[1] || "0");
    if (isNaN(amount) || amount <= 0) {
      return {
        type: "text",
        value: "❌ Invalid threshold amount. Usage: /cost set-threshold <amount>",
      };
    }
    tracker.setCostThreshold(amount);
    return {
      type: "text",
      value: `✅ Cost threshold set to $${amount.toFixed(2)}`,
    };
  }

  // Default: show summary
  const summary = tracker.getSummary();
  return {
    type: "text",
    value: summary,
  };
};
