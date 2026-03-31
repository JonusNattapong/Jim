/**
 * Unified Command Queue - Centralized async coordination
 * Pattern: Claude Code coordinates all async operations via a command queue
 * 
 * Problem: Multiple commands can execute concurrently causing race conditions
 * Solution: Queue all commands, execute sequentially with proper locking
 */

import { childLogger } from "../utils/logger.js";

export type CommandType = "tool" | "query" | "compaction" | "save" | "reset";
export type CommandPriority = "high" | "normal" | "low";

export interface Command {
  id: string;
  type: CommandType;
  priority: CommandPriority;
  execute: () => Promise<unknown>;
  metadata?: Record<string, unknown>;
  createdAt: number;
  timeout?: number; // milliseconds
}

export interface CommandResult {
  commandId: string;
  type: CommandType;
  success: boolean;
  result?: unknown;
  error?: Error;
  duration: number;
  timestamp: number;
}

export type CommandListener = (result: CommandResult) => void;

/**
 * Priority queue with deduplication
 */
class PriorityCommandQueue {
  private commands: Command[] = [];
  private executing: Set<string> = new Set();

  enqueue(cmd: Command): void {
    // Avoid duplicate tool commands to same target
    if (cmd.type === "tool") {
      const toolTarget = cmd.metadata?.target;
      const isDuplicate = this.commands.some(
        (c) =>
          c.type === "tool" &&
          c.metadata?.target === toolTarget &&
          c.metadata?.toolName === cmd.metadata?.toolName,
      );

      if (isDuplicate) {
        return;
      }
    }

    this.commands.push(cmd);
    this.sort();
  }

  dequeue(): Command | undefined {
    return this.commands.shift();
  }

  private sort(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.commands.sort((a, b) => {
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }

  size(): number {
    return this.commands.length;
  }

  isEmpty(): boolean {
    return this.commands.length === 0;
  }

  markExecuting(id: string): void {
    this.executing.add(id);
  }

  markCompleted(id: string): void {
    this.executing.delete(id);
  }

  isExecuting(id: string): boolean {
    return this.executing.has(id);
  }

  getExecutingCount(): number {
    return this.executing.size;
  }
}

/**
 * Unified command queue executor
 */
export class UnifiedCommandQueue {
  private queue: PriorityCommandQueue = new PriorityCommandQueue();
  private isRunning: boolean = false;
  private listeners: Set<CommandListener> = new Set();
  private history: CommandResult[] = [];
  private maxHistory: number = 100;
  private log = childLogger({ component: "UnifiedCommandQueue" });

  /**
   * Add command to queue
   */
  enqueue(
    type: CommandType,
    execute: () => Promise<unknown>,
    priority: CommandPriority = "normal",
    metadata?: Record<string, unknown>,
  ): string {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cmd: Command = {
      id,
      type,
      priority,
      execute,
      metadata,
      createdAt: Date.now(),
    };

    this.queue.enqueue(cmd);
    this.log.debug({ id, type, priority, queueSize: this.queue.size() }, "Command enqueued");

    // Auto-start if not running
    if (!this.isRunning) {
      this.start().catch((err) =>
        this.log.error({ error: err }, "Queue startup failed"),
      );
    }

    return id;
  }

  /**
   * Start processing queue
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.log.info("Command queue started");

    try {
      while (!this.queue.isEmpty()) {
        const cmd = this.queue.dequeue();
        if (!cmd) break;

        const result = await this.executeCommand(cmd);
        this.notifyListeners(result);
      }
    } finally {
      this.isRunning = false;
      this.log.info("Command queue stopped");
    }
  }

  /**
   * Execute a single command with timeout
   */
  private async executeCommand(cmd: Command): Promise<CommandResult> {
    const startTime = Date.now();
    this.queue.markExecuting(cmd.id);

    try {
      let result: unknown;

      if (cmd.timeout) {
        result = await Promise.race([
          cmd.execute(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Command timeout: ${cmd.type}`)),
              cmd.timeout,
            ),
          ),
        ]);
      } else {
        result = await cmd.execute();
      }

      const duration = Date.now() - startTime;
      const cmdResult: CommandResult = {
        commandId: cmd.id,
        type: cmd.type,
        success: true,
        result,
        duration,
        timestamp: Date.now(),
      };

      this.log.debug(
        { id: cmd.id, type: cmd.type, duration, success: true },
        "Command executed",
      );

      this.addToHistory(cmdResult);
      return cmdResult;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const duration = Date.now() - startTime;

      const cmdResult: CommandResult = {
        commandId: cmd.id,
        type: cmd.type,
        success: false,
        error,
        duration,
        timestamp: Date.now(),
      };

      this.log.warn(
        { id: cmd.id, type: cmd.type, duration, error: error.message },
        "Command failed",
      );

      this.addToHistory(cmdResult);
      return cmdResult;
    } finally {
      this.queue.markCompleted(cmd.id);
    }
  }

  /**
   * Subscribe to command results
   */
  subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(result: CommandResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (err) {
        this.log.error({ error: err }, "Listener error");
      }
    }
  }

  /**
   * Add result to history
   */
  private addToHistory(result: CommandResult): void {
    this.history.push(result);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      queueSize: this.queue.size(),
      executing: this.queue.getExecutingCount(),
      history: this.history.length,
    };
  }

  /**
   * Get command history
   */
  getHistory(limit: number = 20): CommandResult[] {
    return this.history.slice(-limit);
  }

  /**
   * Get successful/failed stats
   */
  getStats() {
    let successful = 0;
    let failed = 0;
    let totalDuration = 0;

    for (const result of this.history) {
      totalDuration += result.duration;
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: this.history.length,
      successful,
      failed,
      successRate: this.history.length > 0 ? successful / this.history.length : 0,
      avgDuration: this.history.length > 0 ? totalDuration / this.history.length : 0,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Wait for queue to empty
   */
  async waitUntilEmpty(): Promise<void> {
    return new Promise((resolve) => {
      const checkEmpty = () => {
        if (this.queue.isEmpty() && !this.isRunning) {
          resolve();
        } else {
          setTimeout(checkEmpty, 100);
        }
      };
      checkEmpty();
    });
  }
}
