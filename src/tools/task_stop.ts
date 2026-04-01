import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_stop_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_stop",
    description: "Stop a running task and optionally save its output.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Task ID to stop",
        },
        output: {
          type: "string",
          description: "Optional output/result to save with the task",
        },
      },
      required: ["id"],
    },
  },
};

export const task_stop_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const task = await taskManager.stopTask(args.id, args.output);
  if (!task)
    return {
      content: `Error: Task with ID ${args.id} not found.`,
      isError: true,
    };

  return { content: `Task stopped: [${task.id}] ${task.description}` };
};
