import type { EventEmitter } from "node:events";

/**
 * Cost tracking per model and provider
 * Adapted from Claude Code's cost-hook.ts pattern
 */

export interface CostEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: number;
}

export interface CostStats {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costByModel: Record<string, { cost: number; tokens: number }>;
  costByProvider: Record<string, { cost: number; tokens: number }>;
  entries: CostEntry[];
}

// Model pricing (USD per 1M tokens) - Updated 2026
const PRICING: Record<
  string,
  Record<string, { input: number; output: number }>
> = {
  openai: {
    "gpt-4o": { input: 2.5, output: 10.0 },
    "gpt-4-turbo": { input: 10.0, output: 30.0 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  },
  anthropic: {
    "claude-3-opus": { input: 15.0, output: 75.0 },
    "claude-3-sonnet": { input: 3.0, output: 15.0 },
    "claude-3-haiku": { input: 0.8, output: 4.0 },
  },
  google: {
    "gemini-1.5-pro": { input: 1.25, output: 5.0 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  },
  groq: {
    "mixtral-8x7b": { input: 0.24, output: 0.24 },
    "llama2-70b": { input: 0.7, output: 0.9 },
  },
};

export class CostTracker {
  private stats: CostStats = {
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    costByModel: {},
    costByProvider: {},
    entries: [],
  };

  private targetBudget: number = Infinity;
  private costThreshold: number = 100; // Alert if cost exceeds $100

  constructor(private emitter?: EventEmitter) {}

  /**
   * Set a budget limit for cost tracking
   */
  setBudget(budgetUSD: number): void {
    this.targetBudget = budgetUSD;
  }

  /**
   * Set cost alert threshold
   */
  setCostThreshold(thresholdUSD: number): void {
    this.costThreshold = thresholdUSD;
  }

  /**
   * Record a token usage event
   */
  recordUsage(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const cost = this.calculateCost(model, provider, inputTokens, outputTokens);

    const entry: CostEntry = {
      model,
      provider,
      inputTokens,
      outputTokens,
      costUSD: cost,
      timestamp: Date.now(),
    };

    this.stats.entries.push(entry);
    this.stats.totalCostUSD += cost;
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += outputTokens;

    // Update per-model costs
    if (!this.stats.costByModel[model]) {
      this.stats.costByModel[model] = { cost: 0, tokens: 0 };
    }
    this.stats.costByModel[model].cost += cost;
    this.stats.costByModel[model].tokens += inputTokens + outputTokens;

    // Update per-provider costs
    if (!this.stats.costByProvider[provider]) {
      this.stats.costByProvider[provider] = { cost: 0, tokens: 0 };
    }
    this.stats.costByProvider[provider].cost += cost;
    this.stats.costByProvider[provider].tokens += inputTokens + outputTokens;

    // Emit cost event for hooks
    this.emitter?.emit("cost", {
      model,
      provider,
      cost,
      total: this.stats.totalCostUSD,
      exceeded: this.stats.totalCostUSD > this.targetBudget,
      thresholdExceeded: this.stats.totalCostUSD > this.costThreshold,
    });

    // Check if exceeded threshold
    if (
      this.stats.totalCostUSD > this.costThreshold &&
      this.stats.totalCostUSD - cost <= this.costThreshold
    ) {
      this.emitter?.emit("cost-threshold-exceeded", {
        threshold: this.costThreshold,
        current: this.stats.totalCostUSD,
      });
    }

    // Check if exceeded budget
    if (
      this.stats.totalCostUSD > this.targetBudget &&
      this.stats.totalCostUSD - cost <= this.targetBudget
    ) {
      this.emitter?.emit("budget-exceeded", {
        budget: this.targetBudget,
        current: this.stats.totalCostUSD,
      });
    }
  }

  /**
   * Calculate cost based on pricing table
   */
  private calculateCost(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const providerPricing = PRICING[provider.toLowerCase()];
    if (!providerPricing) {
      console.warn(`Unknown provider: ${provider}`);
      return 0;
    }

    const modelPricing = providerPricing[model.toLowerCase()];
    if (!modelPricing) {
      console.warn(`Unknown model: ${model} for provider ${provider}`);
      return 0;
    }

    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get current cost statistics
   */
  getStats(): CostStats {
    return { ...this.stats };
  }

  /**
   * Get formatted cost summary
   */
  getSummary(): string {
    const lines = [
      `💰 Cost Summary`,
      `Total Cost: $${this.stats.totalCostUSD.toFixed(4)}`,
      `Total Tokens: ${this.stats.totalInputTokens + this.stats.totalOutputTokens}`,
      `Input: ${this.stats.totalInputTokens} | Output: ${this.stats.totalOutputTokens}`,
    ];

    if (Object.keys(this.stats.costByModel).length > 0) {
      lines.push(`\nBy Model:`);
      for (const [model, data] of Object.entries(this.stats.costByModel)) {
        lines.push(
          `  • ${model}: $${data.cost.toFixed(4)} (${data.tokens} tokens)`
        );
      }
    }

    if (Object.keys(this.stats.costByProvider).length > 0) {
      lines.push(`\nBy Provider:`);
      for (const [provider, data] of Object.entries(
        this.stats.costByProvider
      )) {
        lines.push(
          `  • ${provider}: $${data.cost.toFixed(4)} (${data.tokens} tokens)`
        );
      }
    }

    if (this.targetBudget !== Infinity) {
      const remaining = this.targetBudget - this.stats.totalCostUSD;
      lines.push(
        `\nBudget: $${this.targetBudget.toFixed(2)} | Remaining: $${Math.max(0, remaining).toFixed(2)}`
      );
    }

    return lines.join("\n");
  }

  /**
   * Reset cost tracker
   */
  reset(): void {
    this.stats = {
      totalCostUSD: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      costByModel: {},
      costByProvider: {},
      entries: [],
    };
  }

  /**
   * Export costs to JSON
   */
  export(): string {
    return JSON.stringify(this.stats, null, 2);
  }

  /**
   * Import costs from JSON
   */
  import(json: string): void {
    try {
      this.stats = JSON.parse(json);
    } catch (err) {
      console.error("Failed to import cost data:", err);
    }
  }
}

// Global cost tracker instance
let globalCostTracker: CostTracker | null = null;

export function getCostTracker(emitter?: EventEmitter): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker(emitter);
  }
  return globalCostTracker;
}

export function resetCostTracker(): void {
  globalCostTracker = null;
}
