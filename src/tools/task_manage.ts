import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { TaskManager } from "../services/task-manager.js";

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  'todo': ['in-progress', 'done', 'blocked'],
  'in-progress': ['todo', 'done', 'blocked'],
  'done': ['todo'], // can reopen a completed task
  'blocked': ['todo', 'in-progress'],
};

/**
 * Task dependency and status validation
 */
function validateStatusTransition(fromStatus: string, toStatus: string): { valid: boolean; error?: string } {
  if (!VALID_TRANSITIONS[fromStatus]) {
    return { valid: false, error: `Unknown status: ${fromStatus}` };
  }
  if (!VALID_TRANSITIONS[toStatus]) {
    return { valid: false, error: `Unknown status: ${toStatus}` };
  }
  if (!VALID_TRANSITIONS[fromStatus].includes(toStatus)) {
    return { valid: false, error: `Cannot transition from '${fromStatus}' to '${toStatus}'` };
  }
  return { valid: true };
}

const createSchema = z.object({
  action: z.literal("create"),
  description: z.string().min(5).describe("Task description (at least 5 chars)"),
  owner: z.string().optional().describe("Task owner name"),
  dependencies: z.array(z.string()).optional().describe("Task IDs this task depends on"),
});

const updateSchema = z.object({
  action: z.literal("update"),
  id: z.string().describe("Task ID"),
  status: z.enum(["todo", "in-progress", "done", "blocked"]).optional().describe("New status"),
  description: z.string().optional().describe("Updated description"),
  owner: z.string().optional().describe("Updated owner"),
  dependencies: z.array(z.string()).optional().describe("Updated dependencies"),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().describe("Task ID to delete"),
});

const listSchema = z.object({
  action: z.literal("list"),
});

const inputSchema = z.discriminatedUnion("action", [createSchema, updateSchema, listSchema, deleteSchema]);

type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;
type DeleteInput = z.infer<typeof deleteSchema>;
type ListInput = z.infer<typeof listSchema>;

export const task_manage_definition: ToolDefinition = {
  name: "task_manage",
  function: {
    name: "task_manage",
    description: `Create, update, list, or delete tasks in the project task list.
    
WHEN TO USE THIS TOOL:
- Complex multi-step tasks: Break work into 3+ actionable items
- User provides multiple requests: Create one task per item
- To track progress: Mark tasks as in-progress, done, or blocked
- To verify completion: List tasks to show what was accomplished

STATUS VALUES:
- todo: Not started
- in-progress: Currently working (limit one per person)
- done: Completed (automatically archived when all tasks done)
- blocked: Waiting on external dependency

Tasks are persistent and shared between agents. Supports dependencies and ownership.
Structured output shows before/after state for visibility.`,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "list", "delete"],
          description: "The action to perform",
        },
        id: { type: "string", description: "Task ID (for update and delete)" },
        description: { type: "string", description: "Task description (for create and update)" },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "done", "blocked"],
          description: "Task status (for update)",
        },
        owner: { type: "string", description: "Task owner name (for create and update)" },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "Task IDs this task depends on (for create and update)",
        },
      },
      required: ["action"],
    },
  },
};

export const task_manage_handler: ToolHandler = async (args: any, context) => {
  const taskManager = new TaskManager(context.projectRoot || process.cwd());
  await taskManager.init();

  switch (args.action) {
    case "create": {
      // Validate description length
      if (!args.description || args.description.length < 5) {
        return {
          content: `Error: Task description must be at least 5 characters. Error code: TASK_DESCRIPTION_TOO_SHORT`,
          isError: true,
        };
      }

      // Validate dependencies exist
      if (args.dependencies && args.dependencies.length > 0) {
        // This would require fetching existing tasks to validate
        // For now, just warn
      }

      const task = await taskManager.createTask(args.description, args.owner, args.dependencies);
      return {
        content: `✅ Task created: [${task.id}] ${task.description}\nStatus: todo${task.owner ? ` | Owner: ${task.owner}` : ""}`,
        metadata: { taskId: task.id, action: "created" },
      };
    }

    case "update": {
      if (!args.id) {
        return { content: `Error: Task ID required for update. Error code: TASK_ID_MISSING`, isError: true };
      }

      const existingTask = await taskManager.getTask?.(args.id);
      if (!existingTask) {
        return {
          content: `Error: Task with ID ${args.id} not found. Error code: TASK_NOT_FOUND`,
          isError: true,
        };
      }

      // Validate status transition
      if (args.status && args.status !== existingTask.status) {
        const transition = validateStatusTransition(existingTask.status, args.status);
        if (!transition.valid) {
          return {
            content: `Error: ${transition.error}. Error code: INVALID_STATUS_TRANSITION`,
            isError: true,
          };
        }
      }

      const updates: any = {};
      if (args.status) updates.status = args.status;
      if (args.description) updates.description = args.description;
      if (args.owner) updates.owner = args.owner;
      if (args.dependencies) updates.dependencies = args.dependencies;

      const updatedTask = await taskManager.updateTask(args.id, updates);
      if (!updatedTask) {
        return {
          content: `Error: Failed to update task ${args.id}. Error code: TASK_UPDATE_FAILED`,
          isError: true,
        };
      }

      // Show before/after
      const changesSummary = [];
      if (args.status !== existingTask.status) changesSummary.push(`status: ${existingTask.status} → ${args.status}`);
      if (args.description && args.description !== existingTask.description) changesSummary.push(`description updated`);
      if (args.owner && args.owner !== existingTask.owner) changesSummary.push(`owner: ${existingTask.owner ?? 'unassigned'} → ${args.owner}`);

      return {
        content: `✅ Task updated: [${updatedTask.id}]\n${changesSummary.length > 0 ? changesSummary.join("\n") : "No changes"}`,
        metadata: { taskId: updatedTask.id, action: "updated", changes: changesSummary },
      };
    }

    case "list": {
      const formatted = taskManager.formatTaskList();
      return {
        content: `📋 Project Task List:\n\n${formatted}\n\nUse 'task_manage update <id>' to change status, or 'task_manage delete <id>' to remove.`,
        metadata: { action: "listed" },
      };
    }

    case "delete": {
      if (!args.id) {
        return { content: `Error: Task ID required for delete. Error code: TASK_ID_MISSING`, isError: true };
      }

      const deleted = await taskManager.deleteTask(args.id);
      if (!deleted) {
        return {
          content: `Error: Task with ID ${args.id} not found. Error code: TASK_NOT_FOUND`,
          isError: true,
        };
      }
      return {
        content: `✅ Task deleted: ${args.id}`,
        metadata: { taskId: args.id, action: "deleted" },
      };
    }

    default:
      return { content: `Invalid action: ${args.action}. Error code: INVALID_ACTION`, isError: true };
  }
};
