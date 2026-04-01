import type { ToolDefinition, ToolHandler } from "./types.js";
import { CronManager } from "../services/cron-manager.js";

export const cron_list_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_list",
    description: "List all cron jobs with their status and schedule.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const cron_list_handler: ToolHandler = async (args, context) => {
  const cronManager = new CronManager(context?.projectRoot || process.cwd());
  await cronManager.init();

  const formatted = cronManager.formatJobList();
  return { content: `Cron Jobs:\n\n${formatted}` };
};
