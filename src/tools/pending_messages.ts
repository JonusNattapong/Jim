/**
 * Pending Messages Tool for Jim
 * Manage message queue for async processing
 */

import type { ToolDefinition, ToolHandler } from "./types.js";

export const pending_messages_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "pending_messages",
    description:
      "Manage a queue of pending messages. Add messages to be processed later, view the queue, remove messages, or clear completed items. Useful when you want to queue follow-up tasks while working on something else.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add", "list", "remove", "clear", "clear_finished", "stats"],
          description: "Action to perform",
        },
        message: {
          type: "string",
          description: "Message content (required for 'add' action)",
        },
        priority: {
          type: "string",
          enum: ["high", "normal", "low"],
          description: "Message priority (default: normal)",
        },
        id: {
          type: "string",
          description: "Message ID (required for 'remove' action)",
        },
      },
      required: ["action"],
    },
  },
};

export const pending_messages_handler: ToolHandler = async (args) => {
  const { getPendingMessagesQueue } =
    await import("../services/pending-messages.js");
  const queue = getPendingMessagesQueue();

  const action = args.action as string;

  switch (action) {
    case "add": {
      const message = args.message as string;
      if (!message) {
        return {
          content: "Error: 'message' is required for add action",
          isError: true,
        };
      }
      const priority = (args.priority as string) || "normal";
      const msg = queue.add(message, priority as "high" | "normal" | "low");
      const pendingCount = queue.getPendingCount();
      return {
        content: `✅ Message queued: \`${msg.id}\`\nPriority: ${priority}\nPending in queue: ${pendingCount}`,
        metadata: { messageId: msg.id, pendingCount },
      };
    }

    case "list": {
      return { content: queue.format() };
    }

    case "remove": {
      const id = args.id as string;
      if (!id) {
        return {
          content: "Error: 'id' is required for remove action",
          isError: true,
        };
      }
      const removed = queue.remove(id);
      return {
        content: removed
          ? `🗑️ Removed message: \`${id}\``
          : `❌ Message not found: \`${id}\``,
        isError: !removed,
      };
    }

    case "clear": {
      const cleared = queue.clear();
      return {
        content:
          cleared > 0
            ? `🗑️ Cleared ${cleared} pending messages`
            : "No pending messages to clear",
      };
    }

    case "clear_finished": {
      const cleared = queue.clearFinished();
      return {
        content:
          cleared > 0
            ? `🗑️ Cleared ${cleared} finished messages`
            : "No finished messages to clear",
      };
    }

    case "stats": {
      const stats = queue.getStats();
      return {
        content: `📊 **Queue Statistics**\n\n- Total: ${stats.total}\n- Pending: ${stats.pending}\n- Processing: ${stats.processing}\n- Completed: ${stats.completed}\n- Failed: ${stats.failed}`,
      };
    }

    default:
      return {
        content: `Unknown action: ${action}. Valid actions: add, list, remove, clear, clear_finished, stats`,
        isError: true,
      };
  }
};
