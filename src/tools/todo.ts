import type { ToolDefinition, ToolHandler } from "./types.js";

export const todo_write_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "todo_write",
    description:
      "Track your task progress with a structured to-do list. " +
      "Use to break down complex tasks and show progress to the user. " +
      "Status: pending, in_progress, blocked, completed, cancelled.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "list", "clear"],
          description: "Action: create new list, update status, list current, or clear all",
        },
        items: {
          type: "string",
          description: "JSON array of todo items for 'create': [{content, status, priority}]. " +
            "Each item: {content: string, status: 'pending'|'in_progress'|'blocked'|'completed'|'cancelled', priority: 'high'|'medium'|'low', owner?: string, depends_on?: number[], acceptance_criteria?: string, notes?: string}",
        },
        index: {
          type: "number",
          description: "Item index (0-based) for 'update' action",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "blocked", "completed", "cancelled"],
          description: "New status for 'update' action",
        },
        content: {
          type: "string",
          description: "New content for 'update' action (optional)",
        },
        owner: {
          type: "string",
          description: "Task owner for 'update' action (optional)",
        },
        depends_on: {
          type: "array",
          items: { type: "number" },
          description: "List of task indexes this item depends on (optional)",
        },
        acceptance_criteria: {
          type: "string",
          description: "Definition of done for this task (optional)",
        },
        notes: {
          type: "string",
          description: "Additional notes for the task (optional)",
        },
      },
      required: ["action"],
    },
  },
};

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "blocked" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
  owner?: string;
  depends_on?: number[];
  acceptance_criteria?: string;
  notes?: string;
}

let currentTodos: TodoItem[] = [];

export const todo_write_handler: ToolHandler = async (args) => {
  const action = args.action as string;

  switch (action) {
    case "create": {
      if (!args.items) return { content: "Error: 'items' required for create", isError: true };
      try {
        const items = JSON.parse(args.items as string) as TodoItem[];
        currentTodos = items.map((i) => ({
          content: i.content ?? "",
          status: i.status ?? "pending",
          priority: i.priority ?? "medium",
          owner: i.owner ?? undefined,
          depends_on: Array.isArray(i.depends_on) ? i.depends_on : undefined,
          acceptance_criteria: i.acceptance_criteria ?? undefined,
          notes: i.notes ?? undefined,
        }));
        return { content: formatTodos(currentTodos, "Created task list") };
      } catch {
        return { content: "Error: Invalid JSON in 'items'", isError: true };
      }
    }

    case "update": {
      const index = args.index as number;
      if (index === undefined || index < 0 || index >= currentTodos.length) {
        return { content: `Error: Invalid index ${index}. List has ${currentTodos.length} items.`, isError: true };
      }
      if (args.status) currentTodos[index].status = args.status as TodoItem["status"];
      if (args.content) currentTodos[index].content = args.content as string;
      if (typeof args.owner === "string") currentTodos[index].owner = args.owner;
      if (Array.isArray(args.depends_on)) currentTodos[index].depends_on = args.depends_on as number[];
      if (typeof args.acceptance_criteria === "string") currentTodos[index].acceptance_criteria = args.acceptance_criteria;
      if (typeof args.notes === "string") currentTodos[index].notes = args.notes;
      return { content: formatTodos(currentTodos, `Updated item ${index}`) };
    }

    case "list":
      if (currentTodos.length === 0) return { content: "No tasks tracked." };
      return { content: formatTodos(currentTodos, "Current tasks") };

    case "clear":
      currentTodos = [];
      return { content: "Task list cleared." };

    default:
      return { content: `Unknown action: ${action}`, isError: true };
  }
};

function formatTodos(todos: TodoItem[], title: string): string {
  const statusIcon: Record<string, string> = {
    pending: "○",
    in_progress: "●",
    blocked: "◌",
    completed: "✓",
    cancelled: "✗",
  };

  const lines = [`${title}:\n`];
  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    const icon = statusIcon[t.status] ?? "?";
    const prio = t.priority === "high" ? "[!]" : t.priority === "low" ? "[_]" : "   ";
    lines.push(`  ${i}. ${icon} ${prio} ${t.content} [${t.status}]`);
    if (t.owner) lines.push(`      owner: ${t.owner}`);
    if (t.depends_on && t.depends_on.length > 0) lines.push(`      depends_on: ${t.depends_on.join(", ")}`);
    if (t.acceptance_criteria) lines.push(`      acceptance: ${t.acceptance_criteria}`);
    if (t.notes) lines.push(`      notes: ${t.notes}`);
  }

  const stats = {
    completed: todos.filter((t) => t.status === "completed").length,
    in_progress: todos.filter((t) => t.status === "in_progress").length,
    blocked: todos.filter((t) => t.status === "blocked").length,
    pending: todos.filter((t) => t.status === "pending").length,
    total: todos.length,
  };
  lines.push(`\nProgress: ${stats.completed}/${stats.total} done, ${stats.in_progress} in progress, ${stats.blocked} blocked`);

  return lines.join("\n");
}
