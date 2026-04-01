 import type { ToolDefinition, ToolHandler } from "./types.js";
import { CronManager } from "../services/cron-manager.js";

export const cron_delete_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_delete",
    description: "Delete a cron job by ID.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Cron job ID to delete",
        },
      },
      required: ["id"],
    },
  },
};

export const cron_delete_handler: ToolHandler = async (args, context) => {
  const cronManager = new CronManager(context?.projectRoot || process.cwd());
  await cronManager.init();

  const deleted = await cronManager.deleteJob(args.id);
  if (!deleted)
    return {
      content: `Error: Cron job with ID ${args.id} not found.`,
      isError: true,
    };

  return { content: `Cron job deleted: ${args.id}` };
};
