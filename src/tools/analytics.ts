import { childLogger } from "../utils/logger.js";

export interface ToolStats {
  calls: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
  lastError?: string;
  lastCalledAt?: string;
}

export interface AnalyticsSnapshot {
  totalCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  byTool: Record<string, ToolStats>;
  mostUsed: Array<{ tool: string; calls: number }>;
  slowestTools: Array<{ tool: string; avgMs: number }>;
  errorProne: Array<{ tool: string; failures: number; rate: number }>;
}

/**
 * Tool usage analytics — tracks success/fail rates, duration, frequency.
 * Provides insights into which tools are most useful and which cause issues.
 */
export class ToolAnalytics {
  private stats = new Map<string, ToolStats>();
  private log = childLogger({ component: "analytics" });

  /** Record a tool call result */
  record(toolName: string, success: boolean, durationMs: number, error?: string): void {
    const existing = this.stats.get(toolName) ?? {
      calls: 0,
      successes: 0,
      failures: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
    };

    existing.calls++;
    if (success) {
      existing.successes++;
    } else {
      existing.failures++;
      if (error) existing.lastError = error.slice(0, 200);
    }
    existing.totalDurationMs += durationMs;
    existing.avgDurationMs = Math.round(existing.totalDurationMs / existing.calls);
    existing.lastCalledAt = new Date().toISOString();

    this.stats.set(toolName, existing);
  }

  /** Get stats for a specific tool */
  getToolStats(toolName: string): ToolStats | undefined {
    return this.stats.get(toolName);
  }

  /** Get full analytics snapshot */
  getSnapshot(): AnalyticsSnapshot {
    const byTool: Record<string, ToolStats> = {};
    let totalCalls = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    for (const [name, stats] of this.stats) {
      byTool[name] = { ...stats };
      totalCalls += stats.calls;
      totalSuccesses += stats.successes;
      totalFailures += stats.failures;
    }

    const mostUsed = [...this.stats.entries()]
      .map(([tool, s]) => ({ tool, calls: s.calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    const slowestTools = [...this.stats.entries()]
      .map(([tool, s]) => ({ tool, avgMs: s.avgDurationMs }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);

    const errorProne = [...this.stats.entries()]
      .filter(([, s]) => s.failures > 0)
      .map(([tool, s]) => ({ tool, failures: s.failures, rate: s.failures / s.calls }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    return { totalCalls, totalSuccesses, totalFailures, byTool, mostUsed, slowestTools, errorProne };
  }

  /** Format analytics as human-readable text */
  formatReport(): string {
    const snap = this.getSnapshot();
    const lines: string[] = [
      `Tool Analytics: ${snap.totalCalls} calls (${snap.totalSuccesses} ok, ${snap.totalFailures} failed)\n`,
    ];

    if (snap.mostUsed.length > 0) {
      lines.push("Most Used:");
      for (const { tool, calls } of snap.mostUsed) {
        const s = snap.byTool[tool];
        lines.push(`  ${tool}: ${calls} calls (${s.successes} ok, ${s.failures} fail, avg ${s.avgDurationMs}ms)`);
      }
    }

    if (snap.slowestTools.length > 0 && snap.slowestTools[0].avgMs > 0) {
      lines.push("\nSlowest:");
      for (const { tool, avgMs } of snap.slowestTools.filter((t) => t.avgMs > 0).slice(0, 5)) {
        lines.push(`  ${tool}: ${avgMs}ms avg`);
      }
    }

    if (snap.errorProne.length > 0) {
      lines.push("\nError-prone:");
      for (const { tool, failures, rate } of snap.errorProne) {
        lines.push(`  ${tool}: ${failures} failures (${(rate * 100).toFixed(1)}%) - ${snap.byTool[tool].lastError ?? "unknown"}`);
      }
    }

    return lines.join("\n");
  }

  /** Reset all stats */
  reset(): void {
    this.stats.clear();
  }
}
