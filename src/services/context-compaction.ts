/**
 * Context Compaction System
 * 
 * Inspired by Claude Code's multi-layered compaction system that handles
 * conversations exceeding the model's context window. Implements full
 * compaction, micro-compact, and tool result clearing.
 * 
 * @see https://github.com/anthropics/claude-code
 */

import type { Message } from "../agent/query-pipeline.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Compaction trigger types
 */
export type CompactionTrigger =
  | "token_threshold"    // Token usage exceeded threshold
  | "manual"             // User-triggered compaction
  | "auto"               // Automatic based on config
  | "error_recovery";    // Recovery from context overflow

/**
 * Compaction configuration
 */
export interface CompactionConfig {
  /** Token threshold to trigger auto-compaction (0.0 - 1.0) */
  autoCompactThreshold: number;
  /** Maximum tokens in context */
  maxContextTokens: number;
  /** Whether to enable micro-compact */
  enableMicroCompact: boolean;
  /** Whether to clear old tool results */
  clearOldToolResults: boolean;
  /** Number of recent turns to preserve */
  preservedTurns: number;
}

/**
 * Compaction result
 */
export interface CompactionResult {
  success: boolean;
  trigger: CompactionTrigger;
  originalMessageCount: number;
  compactedMessageCount: number;
  tokensSaved: number;
  preservedSegment: PreservedSegment;
  summary?: string;
  durationMs: number;
  error?: string;
}

/**
 * Preserved segment info
 */
export interface PreservedSegment {
  startTurn: number;
  endTurn: number;
  messageCount: number;
  tokenEstimate: number;
}

/**
 * Compaction state
 */
export interface CompactionState {
  isCompacting: boolean;
  lastCompactionAt?: number;
  totalCompactions: number;
  totalTokensSaved: number;
  consecutiveFailures: number;
  preservedSegments: PreservedSegment[];
}

/**
 * Compaction statistics
 */
export interface CompactionStats {
  totalCompactions: number;
  totalTokensSaved: number;
  averageCompressionRatio: number;
  lastCompaction?: {
    trigger: CompactionTrigger;
    tokensSaved: number;
    durationMs: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CompactionConfig = {
  autoCompactThreshold: 0.75,
  maxContextTokens: 100_000,
  enableMicroCompact: true,
  clearOldToolResults: true,
  preservedTurns: 3,
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for a message
 */
export function estimateMessageTokens(message: Message): number {
  if (typeof message.content === "string") {
    return Math.ceil(message.content.length / 4);
  }

  let total = 0;
  for (const block of message.content) {
    if (block.type === "text") {
      total += Math.ceil(block.text.length / 4);
    } else if (block.type === "tool_use") {
      total += Math.ceil(JSON.stringify(block.input).length / 4);
    } else if (block.type === "tool_result") {
      total += Math.ceil(block.content.length / 4);
    }
  }
  return total;
}

/**
 * Estimate total tokens for messages
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// ============================================================================
// Micro-Compact
// ============================================================================

/**
 * Micro-compact: Clear old tool results to free up context
 * Less aggressive than full compaction
 */
export function microCompact(
  messages: Message[],
  config: CompactionConfig
): Message[] {
  if (!config.enableMicroCompact) return messages;

  const recentTurns = config.preservedTurns * 2; // user + assistant pairs
  const cutoffIndex = Math.max(0, messages.length - recentTurns);

  return messages.map((msg, index) => {
    // Keep recent messages untouched
    if (index >= cutoffIndex) return msg;

    // Clear old tool results
    if (msg.role === "tool" && config.clearOldToolResults) {
      return {
        ...msg,
        content: "[Tool result cleared - context compacted]",
      };
    }

    return msg;
  });
}

// ============================================================================
// Full Compaction
// ============================================================================

/**
 * Generate a summarization prompt for compaction
 */
function generateSummaryPrompt(): string {
  return `You are a conversation summarizer. Analyze the following conversation and create a concise summary that preserves:
1. Key decisions made
2. Important context and constraints
3. Current state of work
4. TODOs and next steps

Format your response as:
<analysis>
Brief analysis of what happened
</analysis>

<summary>
Concise summary preserving key information
</summary>

Do NOT include:
- Greetings or pleasantries
- Detailed explanations that can be re-derived
- Tool output that was already processed`;
}

/**
 * Full compaction: Summarize conversation and replace with summary
 */
export function fullCompact(
  messages: Message[],
  config: CompactionConfig,
  summary: string
): Message[] {
  const systemMessage: Message = {
    role: "system",
    content: `[Previous conversation compacted]

${summary}

Continue from where the conversation left off.`,
    timestamp: Date.now(),
    uuid: `compact-${Date.now()}`,
  };

  // Keep only the last N turns after compaction
  const recentTurns = config.preservedTurns * 2;
  const recentMessages = messages.slice(-recentTurns);

  return [systemMessage, ...recentMessages];
}

// ============================================================================
// Compaction Manager
// ============================================================================

/**
 * Manages context compaction with multiple strategies
 */
export class CompactionManager {
  private config: CompactionConfig;
  private state: CompactionState;

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isCompacting: false,
      totalCompactions: 0,
      totalTokensSaved: 0,
      consecutiveFailures: 0,
      preservedSegments: [],
    };
  }

  /**
   * Check if compaction is needed
   */
  shouldCompact(messages: Message[]): boolean {
    const tokens = estimateTotalTokens(messages);
    const threshold = this.config.maxContextTokens * this.config.autoCompactThreshold;
    return tokens >= threshold;
  }

  /**
   * Get recommended compaction trigger
   */
  getRecommendedTrigger(messages: Message[]): CompactionTrigger {
    if (!this.shouldCompact(messages)) {
      return "manual";
    }

    const tokens = estimateTotalTokens(messages);
    const ratio = tokens / this.config.maxContextTokens;

    if (ratio >= 0.9) {
      return "token_threshold";
    }

    return "auto";
  }

  /**
   * Perform micro-compact
   */
  microCompact(messages: Message[]): CompactionResult {
    const startTime = Date.now();
    const originalTokens = estimateTotalTokens(messages);

    const compacted = microCompact(messages, this.config);
    const compactedTokens = estimateTotalTokens(compacted);
    const tokensSaved = originalTokens - compactedTokens;

    this.state.totalCompactions++;
    this.state.totalTokensSaved += tokensSaved;
    this.state.consecutiveFailures = 0;
    this.state.lastCompactionAt = Date.now();

    return {
      success: true,
      trigger: "auto",
      originalMessageCount: messages.length,
      compactedMessageCount: compacted.length,
      tokensSaved,
      preservedSegment: {
        startTurn: 0,
        endTurn: messages.length,
        messageCount: messages.length,
        tokenEstimate: compactedTokens,
      },
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Perform full compaction with summary
   */
  fullCompact(
    messages: Message[],
    summary: string
  ): CompactionResult {
    const startTime = Date.now();
    const originalTokens = estimateTotalTokens(messages);

    const compacted = fullCompact(messages, this.config, summary);
    const compactedTokens = estimateTotalTokens(compacted);
    const tokensSaved = originalTokens - compactedTokens;

    const preservedSegment: PreservedSegment = {
      startTurn: Math.max(0, messages.length - this.config.preservedTurns * 2),
      endTurn: messages.length,
      messageCount: this.config.preservedTurns * 2,
      tokenEstimate: compactedTokens,
    };

    this.state.totalCompactions++;
    this.state.totalTokensSaved += tokensSaved;
    this.state.consecutiveFailures = 0;
    this.state.lastCompactionAt = Date.now();
    this.state.preservedSegments.push(preservedSegment);

    return {
      success: true,
      trigger: "token_threshold",
      originalMessageCount: messages.length,
      compactedMessageCount: compacted.length,
      tokensSaved,
      preservedSegment,
      summary,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Record a compaction failure
   */
  recordFailure(): void {
    this.state.consecutiveFailures++;
  }

  /**
   * Check if compaction should be attempted
   */
  canAttemptCompaction(): boolean {
    return this.state.consecutiveFailures < 3;
  }

  /**
   * Get current state
   */
  getState(): CompactionState {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  getConfig(): CompactionConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): CompactionStats {
    const avgRatio = this.state.totalCompactions > 0
      ? this.state.totalTokensSaved / this.state.totalCompactions
      : 0;

    return {
      totalCompactions: this.state.totalCompactions,
      totalTokensSaved: this.state.totalTokensSaved,
      averageCompressionRatio: Math.round(avgRatio),
    };
  }

  /**
   * Get the summarization prompt
   */
  getSummaryPrompt(): string {
    return generateSummaryPrompt();
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = {
      isCompacting: false,
      totalCompactions: 0,
      totalTokensSaved: 0,
      consecutiveFailures: 0,
      preservedSegments: [],
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format compaction result for display
 */
export function formatCompactionResult(result: CompactionResult): string {
  const lines = [
    `🗜️ Compaction Result`,
    `   Trigger: ${result.trigger}`,
    `   Messages: ${result.originalMessageCount} → ${result.compactedMessageCount}`,
    `   Tokens saved: ${result.tokensSaved.toLocaleString()}`,
    `   Duration: ${result.durationMs}ms`,
  ];
  if (result.summary) {
    lines.push(`   Summary: ${result.summary.slice(0, 100)}...`);
  }
  return lines.join("\n");
}

/**
 * Check if context is near overflow
 */
export function isNearOverflow(
  messages: Message[],
  maxTokens: number,
  threshold = 0.9
): boolean {
  const tokens = estimateTotalTokens(messages);
  return tokens >= maxTokens * threshold;
}

// ============================================================================
// Exports
// ============================================================================

export const ContextCompaction = {
  CompactionManager,
  microCompact,
  fullCompact,
  estimateMessageTokens,
  estimateTotalTokens,
  formatCompactionResult,
  isNearOverflow,
} as const;