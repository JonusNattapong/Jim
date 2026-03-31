import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    description: z.string().describe("Task description"),
    owner: z.string().optional().describe("Task owner name"),
    dependencies: z.array(z.string()).optional().describe("Task IDs this task depends on"),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().describe("Task ID"),
    status: z.enum(["todo", "in-progress", "done", "blocked"]).optional().describe("Update status"),
    description: z.string().optional().describe("Update description"),
    owner: z.string().optional().describe("Update owner"),
    dependencies: z.array(z.string()).optional().describe("Update dependencies"),
  }),
  z.object({
    action: z.literal("list"),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().describe("Task ID to delete"),
  }),
]);

export const task_manage_definition: ToolDefinition = {
  name: "task_manage",
  function: {
    name: "task_manage",
    description: "Create, update, list, or delete tasks in the project task list. Tasks are persistent and shared between agents. Statuses: todo, in-progress, done, blocked.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "list", "delete"], description: "The action to perform" },
        id: { type: "string", description: "Task ID (for update and delete)" },
        description: { type: "string", description: "Task description (for create and update)" },
        status: { type: "string", enum: ["todo", "in-progress", "done", "blocked"], description: "Task status (for update)" },
        owner: { type: "string", description: "Task owner name (for create and update)" },
        dependencies: { type: "array", items: { type: "string" }, description: "Task IDs this task depends on (for create and update)" }
      },
      required: ["action"]
    }
  }
};

export const task_manage_handler: ToolHandler = async (args: any, context) => {
  const taskManager = new TaskManager(context.projectRoot || process.cwd());
  await taskManager.init();

  switch (args.action) {
    case "create": {
      const task = await taskManager.createTask(args.description, args.owner, args.dependencies);
      return {
        content: `Task created: [${task.id}] ${task.description}`,
        metadata: { taskId: task.id },
      };
    }
    case "update": {
      const updates: any = {};
      if (args.status) updates.status = args.status;
      if (args.description) updates.description = args.description;
      if (args.owner) updates.owner = args.owner;
      if (args.dependencies) updates.dependencies = args.dependencies;

      const task = await taskManager.updateTask(args.id, updates);
      if (!task) return { content: `Error: Task with ID ${args.id} not found.`, isError: true };
      return { content: `Task updated: [${task.id}] status set to ${task.status}` };
    }
    case "list": {
      const formatted = taskManager.formatTaskList();
      return { content: `Project Task List:\n\n${formatted}` };
    }
    case "delete": {
      const deleted = await taskManager.deleteTask(args.id);
      if (!deleted) return { content: `Error: Task with ID ${args.id} not found.`, isError: true };
      return { content: `Task deleted: ${args.id}` };
    }
    default:
      return { content: `Invalid action: ${args.action}`, isError: true };
  }
};
