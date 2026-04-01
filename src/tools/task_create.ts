import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_create_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_create",
    description:
      "Create a new task in the project task list. Tasks are persistent and can be tracked across sessions.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Task description",
        },
        owner: {
          type: "string",
          description: "Task owner name (optional)",
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "Task IDs this task depends on (optional)",
        },
      },
      required: ["description"],
    },
  },
};

export const task_create_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const task = await taskManager.createTask(
    args.description,
    args.owner,
    args.dependencies,
  );

  return {
    content: `Task created: [${task.id}] ${task.description}`,
    metadata: { taskId: task.id },
  };
};
