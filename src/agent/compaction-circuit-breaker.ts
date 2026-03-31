/**
 * Auto-Compaction Circuit Breaker - Stops infinite retry loops
 * Pattern: Claude Code's circuit breaker pattern for context compaction
 * 
 * Problem: If compaction fails, retry can loop infinitely, wasting tokens
 * Solution: Track compaction failures, stop after N failures, escalate to user
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Open circuit after N failures
  successThreshold: number; // Close after N successes in half-open
  resetTimeoutMs: number; // Time before attempting to half-open
  onStateChange?: (state: CircuitState) => void;
}

export interface CompactionFailure {
  timestamp: number;
  reason: string;
  context?: {
    messageCount: number;
    estTokens: number;
  };
}

/**
 * Circuit breaker for auto-compaction
 */
export class AutoCompactionCircuitBreaker {
  private state: CircuitState = "closed";
  private failures: CompactionFailure[] = [];
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      successThreshold: config.successThreshold ?? 2,
      resetTimeoutMs: config.resetTimeoutMs ?? 60000,
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  /**
   * Check if compaction is allowed
   */
  canAttemptCompaction(): boolean {
    // Update state if in half-open
    if (this.state === "half-open") {
      const timeElapsed = Date.now() - this.lastFailureTime;
      if (timeElapsed < this.config.resetTimeoutMs) {
        return false; // Still in cooldown
      }
    }

    return this.state !== "open";
  }

  /**
   * Record successful compaction
   */
  recordSuccess(): void {
    this.successes++;
    this.failures = []; // Reset failures

    if (this.state === "half-open" && this.successes >= this.config.successThreshold) {
      this.setState("closed");
    }
  }

  /**
   * Record failed compaction
   */
  recordFailure(reason: string, context?: CompactionFailure["context"]): void {
    const failure: CompactionFailure = {
      timestamp: Date.now(),
      reason,
      context,
    };

    this.failures.push(failure);
    this.lastFailureTime = Date.now();
    this.successes = 0; // Reset successes

    // Keep only last 10 failures
    if (this.failures.length > 10) {
      this.failures.shift();
    }

    // Check if threshold exceeded
    if (this.failures.length >= this.config.failureThreshold) {
      this.setState("open");
    }
  }

  /**
   * Attempt to recover (move to half-open)
   */
  attemptRecovery(): void {
    if (this.state === "open") {
      const timeElapsed = Date.now() - this.lastFailureTime;
      if (timeElapsed >= this.config.resetTimeoutMs) {
        this.setState("half-open");
      }
    }
  }

  /**
   * Get circuit status
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      failureReasons: this.failures.map((f) => f.reason),
      canAttempt: this.canAttemptCompaction(),
      lastFailure: this.failures[this.failures.length - 1],
      nextRetryTime:
        this.state === "open"
          ? this.lastFailureTime + this.config.resetTimeoutMs
          : undefined,
    };
  }

  /**
   * Reset circuit
   */
  reset(): void {
    this.setState("closed");
    this.failures = [];
    this.successes = 0;
  }

  /**
   * Get failure summary
   */
  getFailureSummary(): string {
    if (this.failures.length === 0) return "No failures";

    const reasons = this.failures.reduce(
      (acc, f) => {
        acc[f.reason] = (acc[f.reason] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(reasons)
      .map(([reason, count]) => `${reason} (${count}x)`)
      .join(", ");
  }

  /**
   * Change state
   */
  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      const emoji = {
        closed: "🟢",
        open: "🔴",
        "half-open": "🟡",
      };

      console.log(
        `${emoji[newState]} Compaction circuit: ${this.state} → ${newState}`,
      );

      this.state = newState;
      this.config.onStateChange?.(newState);
    }
  }
}

/**
 * Recommended action based on circuit state
 */
export function getRecommendedAction(breaker: AutoCompactionCircuitBreaker): string {
  const status = breaker.getStatus();

  switch (status.state) {
    case "closed":
      return "✅ Compaction available - proceed normally";

    case "half-open":
      return "🟡 Attempting recovery - compaction disabled temporarily";

    case "open":
      const nextRetry = status.nextRetryTime
        ? new Date(status.nextRetryTime).toLocaleTimeString()
        : "unknown";
      return `🔴 Compaction disabled - too many failures (${breaker.getFailureSummary()}). Will retry at ${nextRetry}`;

    default:
      return "Unknown state";
  }
}
