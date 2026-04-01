import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_get_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_get",
    description: "Get detailed information about a specific task.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Task ID to get",
        },
      },
      required: ["id"],
    },
  },
};

export const task_get_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const task = await taskManager.getTask(args.id);
  if (!task)
    return {
      content: `Error: Task with ID ${args.id} not found.`,
      isError: true,
    };

  const statusIcon =
    task.status === "done"
      ? "✅"
      : task.status === "blocked"
        ? "❌"
        : task.status === "in-progress"
          ? "⏳"
          : task.status === "stopped"
            ? "⏹️"
            : "⬜";

  const ownerStr = task.owner ? `\nOwner: ${task.owner}` : "";
  const depsStr =
    task.dependencies && task.dependencies.length > 0
      ? `\nDependencies: ${task.dependencies.join(", ")}`
      : "";
  const outputStr = task.output ? `\n\nOutput:\n${task.output}` : "";
  const createdStr = new Date(task.createdAt).toLocaleString();
  const updatedStr = new Date(task.updatedAt).toLocaleString();

  return {
    content: `${statusIcon} Task [${task.id}]
Description: ${task.description}
Status: ${task.status}${ownerStr}${depsStr}
Created: ${createdStr}
Updated: ${updatedStr}${outputStr}`,
  };
};
