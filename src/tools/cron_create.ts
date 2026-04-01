import type { ToolDefinition, ToolHandler } from "./types.js";
import { CronManager } from "../services/cron-manager.js";

export const cron_create_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_create",
    description:
      "Create a new scheduled cron job. Uses standard cron expression format (e.g., '0 * * * *' for every hour).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the cron job",
        },
        schedule: {
          type: "string",
          description:
            "Cron expression (e.g., '0 * * * *' for every hour, '0 9 * * *' for daily at 9am)",
        },
        command: {
          type: "string",
          description: "Command or task to execute",
        },
      },
      required: ["name", "schedule", "command"],
    },
  },
};

export const cron_create_handler: ToolHandler = async (args, context) => {
  const cronManager = new CronManager(context?.projectRoot || process.cwd());
  await cronManager.init();

  const job = await cronManager.createJob(
    args.name,
    args.schedule,
    args.command,
  );

  return {
    content: `Cron job created: [${job.id}] ${job.name}\nSchedule: ${job.schedule}\nCommand: ${job.command}`,
    metadata: { cronId: job.id },
  };
};
