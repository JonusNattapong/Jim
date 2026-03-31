/**
 * Rate Limit Management for Jim
 * Track and manage API rate limits across providers
 */

import { EventEmitter } from "events";

export interface RateLimitConfig {
  provider: string;
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

export interface RateLimitStatus {
  provider: string;
  requestsRemaining: number;
  tokensRemaining: number;
  resetAt: number;
  isLimited: boolean;
  retryAfter?: number;
}

export class RateLimitManager extends EventEmitter {
  private limits: Map<string, RateLimitConfig> = new Map();
  private usage: Map<
    string,
    { requests: number; tokens: number; windowStart: number }
  > = new Map();
  private dailyUsage: Map<
    string,
    { requests: number; tokens: number; dayStart: number }
  > = new Map();

  constructor() {
    super();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.limits.set("openai", {
      provider: "openai",
      requestsPerMinute: 500,
      tokensPerMinute: 800000,
      requestsPerDay: 10000,
      tokensPerDay: 2000000,
    });
    this.limits.set("anthropic", {
      provider: "anthropic",
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      requestsPerDay: 1000,
      tokensPerDay: 5000000,
    });
    this.limits.set("google", {
      provider: "google",
      requestsPerMinute: 60,
      tokensPerMinute: 120000,
      requestsPerDay: 1500,
      tokensPerDay: 10000000,
    });
    this.limits.set("deepseek", {
      provider: "deepseek",
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      requestsPerDay: 2000,
    });
    this.limits.set("groq", {
      provider: "groq",
      requestsPerMinute: 30,
      tokensPerMinute: 60000,
      requestsPerDay: 500,
    });
  }

  checkLimit(
    provider: string,
    tokens: number = 0,
  ): { allowed: boolean; reason?: string; retryAfter?: number } {
    const config = this.limits.get(provider);
    if (!config) return { allowed: true };

    const now = Date.now();
    const usage = this.getUsage(provider, now);
    const daily = this.getDailyUsage(provider, now);

    if (usage.requests >= config.requestsPerMinute) {
      const retryAfter = Math.ceil((usage.windowStart + 60000 - now) / 1000);
      return {
        allowed: false,
        reason: `Rate limit: ${config.requestsPerMinute} requests/minute`,
        retryAfter,
      };
    }

    if (usage.tokens + tokens > config.tokensPerMinute) {
      const retryAfter = Math.ceil((usage.windowStart + 60000 - now) / 1000);
      return {
        allowed: false,
        reason: `Token limit: ${config.tokensPerMinute} tokens/minute`,
        retryAfter,
      };
    }

    if (config.requestsPerDay && daily.requests >= config.requestsPerDay) {
      const retryAfter = Math.ceil((daily.dayStart + 86400000 - now) / 1000);
      return {
        allowed: false,
        reason: `Daily limit: ${config.requestsPerDay} requests/day`,
        retryAfter,
      };
    }

    return { allowed: true };
  }

  recordUsage(provider: string, tokens: number = 0): void {
    const now = Date.now();
    const usage = this.getUsage(provider, now);
    usage.requests++;
    usage.tokens += tokens;
    this.usage.set(provider, usage);

    const daily = this.getDailyUsage(provider, now);
    daily.requests++;
    daily.tokens += tokens;
    this.dailyUsage.set(provider, daily);

    this.emit("usageRecorded", { provider, tokens });
  }

  private getUsage(
    provider: string,
    now: number,
  ): { requests: number; tokens: number; windowStart: number } {
    const existing = this.usage.get(provider);
    if (existing && now - existing.windowStart < 60000) return existing;
    return { requests: 0, tokens: 0, windowStart: now };
  }

  private getDailyUsage(
    provider: string,
    now: number,
  ): { requests: number; tokens: number; dayStart: number } {
    const existing = this.dailyUsage.get(provider);
    if (existing && now - existing.dayStart < 86400000) return existing;
    return { requests: 0, tokens: 0, dayStart: now };
  }

  getStatus(provider: string): RateLimitStatus | null {
    const config = this.limits.get(provider);
    if (!config) return null;

    const now = Date.now();
    const usage = this.getUsage(provider, now);

    return {
      provider,
      requestsRemaining: Math.max(0, config.requestsPerMinute - usage.requests),
      tokensRemaining: Math.max(0, config.tokensPerMinute - usage.tokens),
      resetAt: usage.windowStart + 60000,
      isLimited: usage.requests >= config.requestsPerMinute,
    };
  }

  getAllStatuses(): RateLimitStatus[] {
    return Array.from(this.limits.keys())
      .map((p) => this.getStatus(p))
      .filter((s): s is RateLimitStatus => s !== null);
  }

  formatReport(): string {
    const statuses = this.getAllStatuses();
    if (statuses.length === 0) return "No rate limits configured.";

    return [
      "⚡ **Rate Limit Status**",
      "",
      ...statuses.map((s) => {
        const status = s.isLimited ? "🔴 LIMITED" : "🟢 OK";
        return `### ${s.provider} ${status}\nRequests: ${s.requestsRemaining} remaining\nTokens: ${s.tokensRemaining} remaining\nResets: ${new Date(s.resetAt).toLocaleTimeString()}`;
      }),
    ].join("\n");
  }
}
