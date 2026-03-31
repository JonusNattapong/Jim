/**
 * Streaming Tool Executor - Concurrent-safe tool execution with buffering
 * Pattern: Inspired by Claude Code's StreamingToolExecutor
 * 
 * Handles:
 * - Concurrent tool execution with semaphores
 * - Streaming results with proper ordering
 * - Queue management and backpressure
 * - Interleaved execution of multiple tools
 */

import type { ToolHandler, ToolResult } from "../tools/types.js";
import { childLogger } from "../utils/logger.js";

export interface ExecutorConfig {
  maxConcurrent?: number;
  timeoutMs?: number;
  maxRetries?: number;
  // Optional partition concurrency map (partition name -> permits)
  partitions?: Record<string, number>;
  // Optional resolver to decide which partition a task belongs to
  partitionResolver?: (task: ToolExecutionTask) => string;
}

export interface ToolExecutionTask {
  toolName: string;
  handler: ToolHandler;
  args: Record<string, unknown>;
  priority?: number;
  retries?: number;
  // Optional explicit partition override
  partition?: string;
}

export interface ExecutionResult {
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  executionTimeMs: number;
  retryCount: number;
  error?: Error;
}

/**
 * Semaphore for controlling concurrent execution
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(() => {
        this.permits--;
        resolve();
      });
    });
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      this.permits++;
      next();
    } else {
      this.permits++;
    }
  }

  /** Try to acquire immediately without waiting. Returns true if acquired. */
  tryAcquire(): boolean {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }
    return false;
  }

  /** Returns the number of currently available permits. */
  availablePermits(): number {
    return this.permits;
  }
}

/**
 * Priority queue for task execution
 */
class PriorityQueue<T> {
  private items: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number = 0): void {
    this.items.push({ item, priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

export class StreamingToolExecutor {
  private semaphore: Semaphore;
  private partitionSemaphores: Map<string, Semaphore>;
  private queue: PriorityQueue<ToolExecutionTask>;
  private results: Map<string, ExecutionResult> = new Map();
  private activeExecutions: Map<string, Promise<ExecutionResult>> = new Map();
  // Sibling abort controller: aborting this will signal all in-flight child controllers
  private siblingAbortController: AbortController;
  // In-memory update queue for streaming progress / start/complete events
  private updates: Array<{ type: "start" | "complete" | "error"; id: string; toolName: string; args: Record<string, unknown>; result?: ExecutionResult; error?: string }> = [];
  private updateWaiters: Array<() => void> = [];
  private config: Required<ExecutorConfig>;
  private partitionResolver: (task: ToolExecutionTask) => string;
  private log = childLogger({ component: "StreamingToolExecutor" });
  // Number of in-flight tool executions
  private inFlight = 0;

  constructor(config: ExecutorConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      timeoutMs: config.timeoutMs ?? 30000,
      maxRetries: config.maxRetries ?? 2,
      partitions: config.partitions ?? {},
      partitionResolver: config.partitionResolver ?? ((task: ToolExecutionTask) => {
        const n = task.toolName.toLowerCase();
        if (/read|grep|file|search|fetch|list|ls|stat|cat/.test(n)) return "read";
        if (/write|edit|save|commit|apply|patch/.test(n)) return "write";
        if (/bash|shell|system|agent|mcp|lsp|spawn|exec|run|install|docker/.test(n)) return "system";
        return "default";
      }),
    };

    // Build partition semaphores. If user provided explicit partitions use them,
    // otherwise derive a small set of sensible defaults (read/write/system).
    const mc = this.config.maxConcurrent;
    const defaultPartitions = config.partitions ?? (() => {
      const read = Math.max(1, Math.floor(mc * 0.6));
      const write = Math.max(1, Math.floor(mc * 0.3));
      const system = Math.max(1, mc - read - write);
      return { read, write, system } as Record<string, number>;
    })();

    this.partitionSemaphores = new Map();
    // Ensure there's a 'default' semaphore as a fallback
    if (!defaultPartitions.default) {
      defaultPartitions.default = mc;
    }

    for (const [name, permits] of Object.entries(defaultPartitions)) {
      this.partitionSemaphores.set(name, new Semaphore(Math.max(1, permits)));
    }

    // Keep a direct reference for legacy single-semaphore usage (default partition)
    this.semaphore = this.partitionSemaphores.get("default") ?? new Semaphore(this.config.maxConcurrent);
    this.queue = new PriorityQueue();

    this.partitionResolver = this.config.partitionResolver;

    this.siblingAbortController = new AbortController();
  }

  /**
   * Execute a single tool with automatic retry
   */
  async executeTool(
    toolName: string,
    handler: ToolHandler,
    args: Record<string, unknown>,
    retries: number = 0,
    partition?: string,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    // Create a per-tool child abort controller linked to siblingAbortController
    const childAbort = new AbortController();
    const onSiblingAbort = () => {
      try { childAbort.abort(); } catch { /* ignore */ }
    };
    this.siblingAbortController.signal.addEventListener("abort", onSiblingAbort, { once: true });

    // Expose abort signal to handlers via a reserved key so long-running tools can listen
    const handlerArgs = { ...args, __abortSignal: childAbort.signal };

    // Track in-flight executions for getRemainingResults lifecycle
    this.inFlight++;

    try {

    // Decide which semaphore to use for this task (partition-specific)
    const fakeTask: ToolExecutionTask = { toolName, handler, args, priority: 0, retries };
    const partitionName = partition ?? this.partitionResolver(fakeTask);
    const sem = this.partitionSemaphores.get(partitionName) ?? this.semaphore;

    const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Notify start immediately so caller can show progress
    this.pushUpdate({ type: "start", id, toolName, args: handlerArgs });

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await sem.acquire();

        try {
          const result = await Promise.race([
            // Pass the child abort signal inside args so handlers may implement cooperative cancellation
            handler(handlerArgs),
            new Promise<ToolResult>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Tool timeout: ${toolName}`)),
                this.config.timeoutMs,
              ),
            ),
          ]);

          const executionTimeMs = Date.now() - startTime;
          this.log.debug(
            { toolName, attempt, executionTimeMs, partition: partitionName },
            "Tool executed successfully",
          );

          const execResult: ExecutionResult = {
            toolName,
            args,
            result,
            executionTimeMs,
            retryCount: attempt,
          };

          // If the tool signals siblingAbort, trigger parent controller
          if (result && (result as any).siblingAbort) {
            try { this.siblingAbortController.abort(); } catch { /* ignore */ }
          }

          // Push completion update
          this.pushUpdate({ type: "complete", id, toolName, args: handlerArgs, result: execResult });

          return {
            toolName,
            args,
            result,
            executionTimeMs,
            retryCount: attempt,
          };
        } finally {
          sem.release();
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log.warn(
          { toolName, attempt, error: lastError.message, partition: partitionName },
          "Tool execution failed, retrying...",
        );

        if (attempt === this.config.maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100),
        );
      }
    }

    const executionTimeMs = Date.now() - startTime;
    this.log.error(
      { toolName, retries: this.config.maxRetries, error: lastError?.message },
      "Tool execution failed after retries",
    );

    const failed: ExecutionResult = {
      toolName,
      args,
      result: {
        content: `Tool execution failed: ${lastError?.message ?? "Unknown error"}`,
        isError: true,
      },
      executionTimeMs,
      retryCount: this.config.maxRetries,
      error: lastError,
    };
    this.pushUpdate({ type: "error", id: `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`, toolName, args: handlerArgs, error: lastError?.message, result: failed });

    return {
      toolName,
      args,
      result: {
        content: `Tool execution failed: ${lastError?.message ?? "Unknown error"}`,
        isError: true,
      },
      executionTimeMs,
      retryCount: this.config.maxRetries,
      error: lastError,
    };
    } finally {
      this.inFlight = Math.max(0, this.inFlight - 1);
    }
  }

  /** Push an update and notify any waiting consumers */
  private pushUpdate(u: { type: "start" | "complete" | "error"; id: string; toolName: string; args: Record<string, unknown>; result?: ExecutionResult; error?: string }) {
    this.updates.push(u);
    // notify waiting generators
    for (const r of this.updateWaiters.splice(0)) {
      try { r(); } catch { /* ignore */ }
    }
  }

  /**
   * Async generator that yields start/complete/error updates as they arrive.
   * Consumers should iterate this and break when done.
   */
  async *getRemainingResults(): AsyncGenerator<{
    type: "start" | "complete" | "error";
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    result?: ExecutionResult;
    error?: string;
  }, void> {
    while (true) {
      while (this.updates.length > 0) {
        const u = this.updates.shift()!;
        yield u;
      }

      // If nothing active and queue empty, we're done
      if (this.inFlight === 0 && this.queue.isEmpty()) break;

      // Wait for next update
      await new Promise<void>((resolve) => this.updateWaiters.push(resolve));
    }
  }

  /**
   * Queue multiple tools for execution with priority
   */
  queueTools(tasks: ToolExecutionTask[]): string {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tasks.forEach((task) => {
      this.queue.enqueue({ ...task, priority: task.priority ?? 0 }, task.priority ?? 0);
    });
    return batchId;
  }

  /**
   * Execute queued tasks concurrently
   */
  async executeQueue(): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const executions: Promise<ExecutionResult>[] = [];

    while (!this.queue.isEmpty()) {
      const task = this.queue.dequeue();
      if (!task) break;

      const execution = this.executeTool(
        task.toolName,
        task.handler,
        task.args,
        task.retries,
        task.partition,
      );

      executions.push(execution);

      // Maintain concurrency limit
      if (executions.length >= this.config.maxConcurrent) {
        const completed = await Promise.race(executions);
        results.push(completed);
        executions.splice(executions.indexOf(execution), 1);
      }
    }

    // Wait for remaining executions
    const remaining = await Promise.all(executions);
    results.push(...remaining);

    return results;
  }

  /**
   * Get current queue status
   */
  getStatus() {
    const partitions: Record<string, { available: number }> = {};
    for (const [name, sem] of this.partitionSemaphores.entries()) {
      partitions[name] = { available: sem.availablePermits() };
    }

    return {
      queueSize: this.queue.size(),
      activeExecutions: this.activeExecutions.size,
      maxConcurrent: this.config.maxConcurrent,
      resultsCount: this.results.size,
      partitions,
    };
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.queue = new PriorityQueue();
    this.results.clear();
    this.activeExecutions.clear();
  }
}
