import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

export const task_list_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_list",
    description: "List all tasks in the project task list with their status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const task_list_handler: ToolHandler = async (args, context) => {
  const taskManager = new TaskManager(context?.projectRoot || process.cwd());
  await taskManager.init();

  const formatted = taskManager.formatTaskList();
  return { content: `Project Task List:\n\n${formatted}` };
};
