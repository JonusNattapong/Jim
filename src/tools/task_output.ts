import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_output_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_output",
    description: "Get the output/result of a completed or stopped task.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Task ID to get output from",
        },
      },
      required: ["id"],
    },
  },
};

export const task_output_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const task = await taskManager.getTask(args.id);
  if (!task)
    return {
      content: `Error: Task with ID ${args.id} not found.`,
      isError: true,
    };

  const output = task.output || "No output recorded for this task.";
  return {
    content: `Task [${task.id}] Output:\n\n${output}`,
  };
};
