import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_update_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_update",
    description: "Update a task's status, description, owner, or dependencies.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Task ID to update",
        },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "done", "blocked", "stopped"],
          description: "New status",
        },
        description: {
          type: "string",
          description: "New description",
        },
        owner: {
          type: "string",
          description: "New owner name",
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "New dependency task IDs",
        },
      },
      required: ["id"],
    },
  },
};

export const task_update_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const updates: any = {};
  if (args.status) updates.status = args.status;
  if (args.description) updates.description = args.description;
  if (args.owner) updates.owner = args.owner;
  if (args.dependencies) updates.dependencies = args.dependencies;

  const task = await taskManager.updateTask(args.id, updates);
  if (!task)
    return {
      content: `Error: Task with ID ${args.id} not found.`,
      isError: true,
    };

  return { content: `Task updated: [${task.id}] ${task.description}` };
};
