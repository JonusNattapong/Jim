/**
 * Analytics Sink Pattern
 * 
 * Inspired by Claude Code's analytics system that queues events
 * until a sink is attached, preventing import cycles.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Analytics event metadata
 */
export interface AnalyticsMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Queued event
 */
export interface QueuedEvent {
  eventName: string;
  metadata: AnalyticsMetadata;
  timestamp: number;
  async: boolean;
}

/**
 * Analytics sink interface
 */
export interface AnalyticsSink {
  logEvent(eventName: string, metadata: AnalyticsMetadata): void;
  logEventAsync(eventName: string, metadata: AnalyticsMetadata): Promise<void>;
}

/**
 * Analytics snapshot for reporting
 */
export interface AnalyticsSnapshot {
  totalEvents: number;
  eventsByName: Record<string, number>;
  toolUsage: Record<string, { count: number; successRate: number; avgDurationMs: number }>;
  sessionDurationMs: number;
}

// ============================================================================
// Analytics Manager
// ============================================================================

/**
 * Manages analytics events with queue-based sink pattern
 */
export class AnalyticsManager {
  private queue: QueuedEvent[] = [];
  private sink: AnalyticsSink | null = null;
  private toolStats: Map<string, { count: number; successes: number; totalDurationMs: number }> = new Map();
  private sessionStart: number = Date.now();

  /**
   * Attach an analytics sink
   */
  attachSink(sink: AnalyticsSink): void {
    this.sink = sink;
    this.drainQueue();
  }

  /**
   * Detach the current sink
   */
  detachSink(): void {
    this.sink = null;
  }

  /**
   * Log an event
   */
  logEvent(eventName: string, metadata: AnalyticsMetadata = {}): void {
    const event: QueuedEvent = {
      eventName,
      metadata,
      timestamp: Date.now(),
      async: false,
    };

    if (this.sink) {
      this.sink.logEvent(eventName, metadata);
    } else {
      this.queue.push(event);
    }
  }

  /**
   * Log an async event
   */
  async logEventAsync(eventName: string, metadata: AnalyticsMetadata = {}): Promise<void> {
    const event: QueuedEvent = {
      eventName,
      metadata,
      timestamp: Date.now(),
      async: true,
    };

    if (this.sink) {
      await this.sink.logEventAsync(eventName, metadata);
    } else {
      this.queue.push(event);
    }
  }

  /**
   * Record tool usage
   */
  recordToolUsage(
    toolName: string,
    success: boolean,
    durationMs: number,
    error?: string
  ): void {
    let stats = this.toolStats.get(toolName);
    if (!stats) {
      stats = { count: 0, successes: 0, totalDurationMs: 0 };
      this.toolStats.set(toolName, stats);
    }

    stats.count++;
    if (success) stats.successes++;
    stats.totalDurationMs += durationMs;

    this.logEvent("tool_usage", {
      toolName,
      success,
      durationMs,
      error: error ?? null,
    });
  }

  /**
   * Drain queued events to sink
   */
  private drainQueue(): void {
    if (!this.sink) return;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      if (event.async) {
        this.sink.logEventAsync(event.eventName, event.metadata);
      } else {
        this.sink.logEvent(event.eventName, event.metadata);
      }
    }
  }

  /**
   * Get analytics snapshot
   */
  getSnapshot(): AnalyticsSnapshot {
    const eventsByName: Record<string, number> = {};
    for (const event of this.queue) {
      eventsByName[event.eventName] = (eventsByName[event.eventName] ?? 0) + 1;
    }

    const toolUsage: Record<string, { count: number; successRate: number; avgDurationMs: number }> = {};
    for (const [name, stats] of this.toolStats) {
      toolUsage[name] = {
        count: stats.count,
        successRate: stats.count > 0 ? stats.successes / stats.count : 0,
        avgDurationMs: stats.count > 0 ? stats.totalDurationMs / stats.count : 0,
      };
    }

    return {
      totalEvents: this.queue.length,
      eventsByName,
      toolUsage,
      sessionDurationMs: Date.now() - this.sessionStart,
    };
  }

  /**
   * Format analytics report
   */
  formatReport(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [
      "📊 Analytics Report",
      `   Session duration: ${(snapshot.sessionDurationMs / 1000).toFixed(1)}s`,
      `   Total events: ${snapshot.totalEvents}`,
      "",
      "🔧 Tool Usage:",
    ];

    const sortedTools = Object.entries(snapshot.toolUsage)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    for (const [name, stats] of sortedTools) {
      const successRate = (stats.successRate * 100).toFixed(1);
      lines.push(
        `   ${name}: ${stats.count} calls, ${successRate}% success, ${stats.avgDurationMs.toFixed(0)}ms avg`
      );
    }

    return lines.join("\n");
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.queue = [];
    this.toolStats.clear();
    this.sessionStart = Date.now();
  }

  /**
   * Get queued event count
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

// ============================================================================
// Console Analytics Sink (for development)
// ============================================================================

/**
 * Simple console-based analytics sink
 */
export function createConsoleSink(): AnalyticsSink {
  return {
    logEvent(eventName: string, metadata: AnalyticsMetadata): void {
      console.log(`[Analytics] ${eventName}`, metadata);
    },
    async logEventAsync(eventName: string, metadata: AnalyticsMetadata): Promise<void> {
      console.log(`[Analytics] ${eventName}`, metadata);
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export const Analytics = {
  AnalyticsManager,
  createConsoleSink,
} as const;