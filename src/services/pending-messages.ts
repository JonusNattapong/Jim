/**
 * Pending Messages Queue for Jim
 * Allows sending messages to a queue while waiting for current task to complete
 */

import { EventEmitter } from "node:events";

export interface PendingMessage {
  id: string;
  content: string;
  timestamp: number;
  priority: "high" | "normal" | "low";
  status: "pending" | "processing" | "completed" | "failed";
  groupId?: string;      // Group ID for Task Groups
  groupName?: string;    // Human readable group name
  parentId?: string;     // Parent task ID for nested work
  error?: string;
}

export class PendingMessagesQueue extends EventEmitter {
  private queue: PendingMessage[] = [];
  private processing = false;
  private counter = 0;

  constructor() {
    super();
  }

  /**
   * Add a message to the pending queue
   */
  add(
    content: string,
    priority: "high" | "normal" | "low" = "normal",
    group?: { id: string; name: string },
    parentId?: string,
  ): PendingMessage {
    const message: PendingMessage = {
      id: `pending_${++this.counter}_${Date.now()}`,
      content,
      timestamp: Date.now(),
      priority,
      status: "pending",
      groupId: group?.id,
      groupName: group?.name,
      parentId,
    };

    // Insert based on priority
    if (priority === "high") {
      // Find first non-high priority item and insert before it
      const idx = this.queue.findIndex(
        (m) => m.priority !== "high" && m.status === "pending",
      );
      if (idx >= 0) {
        this.queue.splice(idx, 0, message);
      } else {
        this.queue.push(message);
      }
    } else if (priority === "low") {
      this.queue.push(message);
    } else {
      // Normal priority - insert before low priority items
      const idx = this.queue.findIndex(
        (m) => m.priority === "low" && m.status === "pending",
      );
      if (idx >= 0) {
        this.queue.splice(idx, 0, message);
      } else {
        this.queue.push(message);
      }
    }

    this.emit("added", message);
    return message;
  }

  /**
   * Get the next pending message
   */
  getNext(): PendingMessage | undefined {
    return this.queue.find((m) => m.status === "pending");
  }

  /**
   * Mark a message as processing
   */
  markProcessing(id: string): boolean {
    const msg = this.queue.find((m) => m.id === id);
    if (msg && msg.status === "pending") {
      msg.status = "processing";
      this.emit("processing", msg);
      return true;
    }
    return false;
  }

  /**
   * Mark a message as completed
   */
  markCompleted(id: string): boolean {
    const msg = this.queue.find((m) => m.id === id);
    if (msg) {
      msg.status = "completed";
      this.emit("completed", msg);
      return true;
    }
    return false;
  }

  /**
   * Mark a message as failed
   */
  markFailed(id: string, error: string): boolean {
    const msg = this.queue.find((m) => m.id === id);
    if (msg) {
      msg.status = "failed";
      msg.error = error;
      this.emit("failed", msg);
      return true;
    }
    return false;
  }

  /**
   * Remove a message from the queue
   */
  remove(id: string): boolean {
    const idx = this.queue.findIndex((m) => m.id === id);
    if (idx >= 0) {
      const msg = this.queue.splice(idx, 1)[0];
      this.emit("removed", msg);
      return true;
    }
    return false;
  }

  /**
   * Clear all pending messages
   */
  clear(): number {
    const pending = this.queue.filter((m) => m.status === "pending");
    this.queue = this.queue.filter((m) => m.status !== "pending");
    this.emit("cleared", pending.length);
    return pending.length;
  }

  /**
   * Clear completed and failed messages
   */
  clearFinished(): number {
    const finished = this.queue.filter(
      (m) => m.status === "completed" || m.status === "failed",
    );
    this.queue = this.queue.filter(
      (m) => m.status !== "completed" && m.status !== "failed",
    );
    return finished.length;
  }

  /**
   * Get all messages
   */
  getAll(): PendingMessage[] {
    return [...this.queue];
  }

  /**
   * Get pending messages only
   */
  getPending(): PendingMessage[] {
    return this.queue.filter((m) => m.status === "pending");
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((m) => m.status === "pending").length,
      processing: this.queue.filter((m) => m.status === "processing").length,
      completed: this.queue.filter((m) => m.status === "completed").length,
      failed: this.queue.filter((m) => m.status === "failed").length,
    };
  }

  /**
   * Check if queue has pending messages
   */
  hasPending(): boolean {
    return this.queue.some((m) => m.status === "pending");
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.queue.filter((m) => m.status === "pending").length;
  }

  /**
   * Reorder a message in the queue
   */
  reorder(id: string, newPosition: number): boolean {
    const idx = this.queue.findIndex((m) => m.id === id);
    if (idx < 0) return false;

    const [msg] = this.queue.splice(idx, 1);
    const insertAt = Math.max(0, Math.min(newPosition, this.queue.length));
    this.queue.splice(insertAt, 0, msg);
    this.emit("reordered", { id, from: idx, to: insertAt });
    return true;
  }

  /**
   * Format queue for display with Task Group support
   */
  format(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push(`📬 **Jim Task Queue**`);
    lines.push(
      `📊 Total: ${stats.total} | Pending: ${stats.pending} | Processing: ${stats.processing} | Completed: ${stats.completed} | Failed: ${stats.failed}`,
    );
    lines.push("");

    if (this.queue.length === 0) {
      lines.push("_Queue is empty._");
      return lines.join("\n");
    }

    // 1. Group tasks by groupName
    const groups: Map<string, PendingMessage[]> = new Map();
    const ungrouped: PendingMessage[] = [];

    for (const msg of this.queue) {
      if (msg.groupName) {
        if (!groups.has(msg.groupName)) groups.set(msg.groupName, []);
        groups.get(msg.groupName)!.push(msg);
      } else if (!msg.parentId) {
         // Only ungrouped tasks that aren't children of a group/task go here
         ungrouped.push(msg);
      }
    }

    // 2. Render Groups
    for (const [name, msgs] of groups.entries()) {
      const completedCount = msgs.filter(m => m.status === 'completed').length;
      lines.push(`📁 **GROUP: ${name}** [${completedCount}/${msgs.length}]`);
      for (const msg of msgs) {
        lines.push(this.formatMessageLine(msg, 2));
      }
      lines.push("");
    }

    // 3. Render Ungrouped Pending/Processing
    const activeUngrouped = ungrouped.filter(m => m.status === 'pending' || m.status === 'processing');
    if (activeUngrouped.length > 0) {
      lines.push(`📝 **ACTIVE TASKS**`);
      for (const msg of activeUngrouped) {
        lines.push(this.formatMessageLine(msg, 0));
        // Check for children
        const children = this.queue.filter(m => m.parentId === msg.id);
        for (const child of children) {
           lines.push(this.formatMessageLine(child, 4));
        }
      }
      lines.push("");
    }

    // 4. Failed/History Summary
    const failed = this.queue.filter((m) => m.status === "failed");
    if (failed.length > 0) {
      lines.push(`❌ **FAILED (${failed.length})**`);
      for (const msg of failed.slice(-3)) {
        lines.push(`  - ${msg.id}: ${msg.content.slice(0, 50)} (${msg.error ?? "error"})`);
      }
    }

    return lines.join("\n");
  }

  private formatMessageLine(msg: PendingMessage, indent: number): string {
    const space = " ".repeat(indent);
    const statusIcon = 
      msg.status === "processing" ? "⏳" :
      msg.status === "completed" ? "✅" :
      msg.status === "failed" ? "❌" :
      (msg.priority === "high" ? "🔴" : msg.priority === "low" ? "🟢" : "🟡");
    
    return `${space}${statusIcon} \`${msg.id}\` - ${msg.content.slice(0, 80)}${msg.content.length > 80 ? "..." : ""}`;
  }
}

// Singleton instance
let instance: PendingMessagesQueue | null = null;

export function getPendingMessagesQueue(): PendingMessagesQueue {
  if (!instance) {
    instance = new PendingMessagesQueue();
  }
  return instance;
}
