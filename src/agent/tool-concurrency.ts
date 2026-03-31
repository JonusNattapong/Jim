/**
 * Tool Concurrency Safety Detection & Partitioning
 * 
 * Inspired by Claude Code's tool orchestration pattern.
 * Partitions tools into concurrent-safe vs exclusive batches,
 * enabling 2-3x faster execution for I/O-heavy operations.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// Self-contained types for tool concurrency
// Avoids import errors when source types don't exist yet

/**
 * Tool use block from the model
 */
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool definition interface
 */
export interface Tool {
  name: string;
  isConcurrencySafe?(input?: Record<string, unknown>): boolean;
  isReadOnly?(input?: Record<string, unknown>): boolean;
  isDestructive?(input?: Record<string, unknown>): boolean;
}

// ============================================================================
// Types
// ============================================================================

/**
 * A tracked tool call with execution metadata
 */
export interface TrackedToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** The tool use block from the model */
  block: ToolUseBlock;
  /** Whether this tool is safe to run concurrently */
  isConcurrencySafe: boolean;
  /** Current execution status */
  status: "queued" | "executing" | "completed" | "failed" | "yielded";
  /** Result messages after execution */
  results?: unknown[];
  /** Pending progress messages */
  pendingProgress: unknown[];
  /** Context modifiers to apply after execution */
  contextModifiers?: Array<(context: unknown) => unknown>;
}

/**
 * A batch of tool calls that can execute together
 */
export interface ToolBatch {
  /** Whether all tools in this batch are concurrency-safe */
  isConcurrencySafe: boolean;
  /** Tool calls in this batch */
  calls: TrackedToolCall[];
}

/**
 * Configuration for the concurrency manager
 */
export interface ConcurrencyConfig {
  /** Maximum number of concurrent tool executions */
  maxConcurrent: number;
  /** Timeout for individual tool execution in ms */
  toolTimeoutMs: number;
  /** Whether to continue on individual tool failure */
  continueOnFailure: boolean;
}

/**
 * Execution result for a single tool
 */
export interface ToolExecutionResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Execution result for a batch
 */
export interface BatchExecutionResult {
  batchIndex: number;
  isConcurrencySafe: boolean;
  results: ToolExecutionResult[];
  totalDurationMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 5,
  toolTimeoutMs: 30_000,
  continueOnFailure: true,
};

// ============================================================================
// Concurrency Safety Detection
// ============================================================================

/**
 * Determine if a tool is concurrency-safe based on its definition
 */
export function isToolConcurrencySafe(
  tool: Tool | undefined,
  input: Record<string, unknown>
): boolean {
  if (!tool) {
    // Unknown tool - assume NOT safe (fail-closed)
    return false;
  }

  // Use tool's own determination if available
  if (typeof tool.isConcurrencySafe === "function") {
    return tool.isConcurrencySafe(input);
  }

  // Check if tool is read-only (read-only is usually concurrency-safe)
  if (typeof tool.isReadOnly === "function") {
    return tool.isReadOnly(input);
  }

  // Default: NOT concurrency-safe (fail-closed)
  return false;
}

/**
 * Check if a tool is read-only
 */
export function isToolReadOnly(
  tool: Tool | undefined,
  input: Record<string, unknown>
): boolean {
  if (!tool) return false;

  if (typeof tool.isReadOnly === "function") {
    return tool.isReadOnly(input);
  }

  return false;
}

// ============================================================================
// Tool Partitioning
// ============================================================================

/**
 * Partition tool calls into batches based on concurrency safety.
 * 
 * Strategy:
 * 1. Consecutive safe tools → batched together
 * 2. Non-safe tool → own batch (serial execution)
 * 3. Mixed batch → split at first non-safe
 * 
 * @example
 * Input:  [safe, safe, unsafe, safe, safe]
 * Output: [[safe, safe], [unsafe], [safe, safe]]
 */
export function partitionToolCalls(
  toolCalls: ToolUseBlock[],
  toolRegistry: Map<string, Tool>
): ToolBatch[] {
  const batches: ToolBatch[] = [];
  let currentBatch: TrackedToolCall[] = [];
  let currentBatchIsSafe = true;

  for (const block of toolCalls) {
    const tool = toolRegistry.get(block.name);
    const input = (block.input ?? {}) as Record<string, unknown>;
    const isSafe = isToolConcurrencySafe(tool, input);

    const tracked: TrackedToolCall = {
      id: block.id,
      block,
      isConcurrencySafe: isSafe,
      status: "queued",
      pendingProgress: [],
    };

    // If this is a non-safe tool, flush current batch and start new one
    if (!isSafe) {
      // Flush current batch if it has items
      if (currentBatch.length > 0) {
        batches.push({
          isConcurrencySafe: currentBatchIsSafe,
          calls: [...currentBatch],
        });
        currentBatch = [];
      }

      // Non-safe tool gets its own batch
      batches.push({
        isConcurrencySafe: false,
        calls: [tracked],
      });
      currentBatchIsSafe = true;
      continue;
    }

    // Safe tool - add to current batch
    currentBatch.push(tracked);
    currentBatchIsSafe = currentBatchIsSafe && isSafe;
  }

  // Flush remaining batch
  if (currentBatch.length > 0) {
    batches.push({
      isConcurrencySafe: currentBatchIsSafe,
      calls: currentBatch,
    });
  }

  return batches;
}

/**
 * Optimized partitioning: groups all safe tools together regardless of position.
 * Non-safe tools still execute serially.
 * 
 * @example
 * Input:  [safe, unsafe, safe, safe, unsafe, safe]
 * Output: [[safe, safe, safe, safe], [unsafe], [unsafe]]
 */
export function partitionToolCallsOptimized(
  toolCalls: ToolUseBlock[],
  toolRegistry: Map<string, Tool>
): ToolBatch[] {
  const safeCalls: TrackedToolCall[] = [];
  const unsafeCalls: TrackedToolCall[] = [];

  for (const block of toolCalls) {
    const tool = toolRegistry.get(block.name);
    const input = (block.input ?? {}) as Record<string, unknown>;
    const isSafe = isToolConcurrencySafe(tool, input);

    const tracked: TrackedToolCall = {
      id: block.id,
      block,
      isConcurrencySafe: isSafe,
      status: "queued",
      pendingProgress: [],
    };

    if (isSafe) {
      safeCalls.push(tracked);
    } else {
      unsafeCalls.push(tracked);
    }
  }

  const batches: ToolBatch[] = [];

  // Batch all safe tools together
  if (safeCalls.length > 0) {
    batches.push({
      isConcurrencySafe: true,
      calls: safeCalls,
    });
  }

  // Each unsafe tool gets its own batch (serial)
  for (const call of unsafeCalls) {
    batches.push({
      isConcurrencySafe: false,
      calls: [call],
    });
  }

  return batches;
}

// ============================================================================
// Semaphore for Concurrency Control
// ============================================================================

/**
 * Simple semaphore for limiting concurrent operations
 */
export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }

  get available(): number {
    return this.permits;
  }

  get pending(): number {
    return this.queue.length;
  }
}

// ============================================================================
// Batch Executor
// ============================================================================

/**
 * Execute a batch of tool calls with concurrency control
 */
export async function* executeBatch(
  batch: ToolBatch,
  executeTool: (
    call: TrackedToolCall
  ) => AsyncGenerator<ToolExecutionResult>,
  config: Partial<ConcurrencyConfig> = {}
): AsyncGenerator<BatchExecutionResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!batch.isConcurrencySafe || batch.calls.length === 1) {
    // Serial execution
    const results: ToolExecutionResult[] = [];
    const startTime = Date.now();

    for (const call of batch.calls) {
      call.status = "executing";
      for await (const result of executeTool(call)) {
        call.status = result.success ? "completed" : "failed";
        results.push(result);
        yield {
          batchIndex: 0,
          isConcurrencySafe: false,
          results: [...results],
          totalDurationMs: Date.now() - startTime,
        };
      }
    }
  } else {
    // Parallel execution with semaphore
    const semaphore = new Semaphore(fullConfig.maxConcurrent);
    const results: ToolExecutionResult[] = [];
    const startTime = Date.now();
    const promises: Promise<void>[] = [];

    for (const call of batch.calls) {
      const promise = (async () => {
        await semaphore.acquire();
        call.status = "executing";

        try {
          for await (const result of executeTool(call)) {
            call.status = result.success ? "completed" : "failed";
            results.push(result);
          }
        } finally {
          semaphore.release();
        }
      })();

      promises.push(promise);
    }

    // Wait for all to complete
    await Promise.allSettled(promises);

    yield {
      batchIndex: 0,
      isConcurrencySafe: true,
      results,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Statistics & Reporting
// ============================================================================

/**
 * Statistics for concurrency execution
 */
export interface ConcurrencyStats {
  totalToolCalls: number;
  safeToolCalls: number;
  unsafeToolCalls: number;
  batchesExecuted: number;
  parallelBatches: number;
  serialBatches: number;
  totalDurationMs: number;
  parallelSpeedup: number; // estimated
}

/**
 * Calculate statistics from batch results
 */
export function calculateConcurrencyStats(
  batches: ToolBatch[],
  results: BatchExecutionResult[]
): ConcurrencyStats {
  const totalToolCalls = batches.reduce((sum, b) => sum + b.calls.length, 0);
  const safeToolCalls = batches
    .filter((b) => b.isConcurrencySafe)
    .reduce((sum, b) => sum + b.calls.length, 0);
  const unsafeToolCalls = totalToolCalls - safeToolCalls;

  const parallelBatches = results.filter((r) => r.isConcurrencySafe).length;
  const serialBatches = results.filter((r) => !r.isConcurrencySafe).length;
  const totalDurationMs = results.reduce((sum, r) => sum + r.totalDurationMs, 0);

  // Estimate speedup: parallel batches would have taken N times longer serially
  const parallelToolCount = batches
    .filter((b) => b.isConcurrencySafe)
    .reduce((sum, b) => sum + b.calls.length, 0);
  const estimatedSerialTime = results
    .filter((r) => r.isConcurrencySafe)
    .reduce((sum, r) => sum + r.totalDurationMs * r.results.length, 0);
  const parallelSpeedup =
    estimatedSerialTime > 0
      ? estimatedSerialTime / (totalDurationMs || 1)
      : 1;

  return {
    totalToolCalls,
    safeToolCalls,
    unsafeToolCalls,
    batchesExecuted: results.length,
    parallelBatches,
    serialBatches,
    totalDurationMs,
    parallelSpeedup: Math.round(parallelSpeedup * 100) / 100,
  };
}

/**
 * Format concurrency stats for display
 */
export function formatConcurrencyStats(stats: ConcurrencyStats): string {
  const lines = [
    "📊 Tool Concurrency Statistics",
    `   Total calls: ${stats.totalToolCalls}`,
    `   Safe (parallel): ${stats.safeToolCalls}`,
    `   Unsafe (serial): ${stats.unsafeToolCalls}`,
    `   Batches: ${stats.batchesExecuted} (${stats.parallelBatches} parallel, ${stats.serialBatches} serial)`,
    `   Duration: ${stats.totalDurationMs}ms`,
    `   Estimated speedup: ${stats.parallelSpeedup}x`,
  ];
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

export const ToolConcurrency = {
  isToolConcurrencySafe,
  isToolReadOnly,
  partitionToolCalls,
  partitionToolCallsOptimized,
  executeBatch,
  calculateConcurrencyStats,
  formatConcurrencyStats,
  Semaphore,
} as const;