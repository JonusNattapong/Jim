/**
 * Context Cache Manager - Memoized context caching with invalidation
 * Pattern: Inspired by Claude Code's memoized context loading
 * 
 * Features:
 * - Lazy-load and cache expensive context (repo map, git status)
 * - Cache invalidation on file changes
 * - TTL-based expiration
 * - Manual invalidation hooks
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { childLogger } from "../utils/logger.js";

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  hash?: string;
  dependencies?: string[];
}

export interface CacheConfig {
  ttlMs?: number;
  maxEntries?: number;
  hashcheck?: boolean;
}

export interface ContextSnapshot {
  projectRoot: string;
  repoMap?: string;
  gitStatus?: string;
  filesChanged?: string[];
  timestamp: number;
  hash: string;
}

/**
 * Simple hash function for change detection
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Context cache manager with invalidation
 */
export class ContextCacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: Required<CacheConfig>;
  private invalidationHooks: Map<string, Set<() => void>> = new Map();
  private log = childLogger({ component: "ContextCacheManager" });

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttlMs: config.ttlMs ?? 3600000, // 1 hour default
      maxEntries: config.maxEntries ?? 50,
      hashcheck: config.hashcheck ?? true,
    };
  }

  /**
   * Get cached value or compute if missing/expired
   */
  async get<T>(
    key: string,
    compute: () => Promise<T>,
    dependencies?: string[],
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Check cache validity
    if (
      cached &&
      cached.expiresAt > now &&
      (!dependencies ||
        !this.hasInvalidatedDependency(dependencies, cached.dependencies))
    ) {
      this.log.debug({ key }, "Cache hit");
      return cached.value as T;
    }

    // Compute and cache
    this.log.debug({ key }, "Cache miss, computing...");
    const value = await compute();
    const hash = this.config.hashcheck ? hashString(JSON.stringify(value)) : undefined;

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + this.config.ttlMs,
      hash,
      dependencies,
    };

    this.cache.set(key, entry);
    this.enforceMaxSize();

    return value;
  }

  /**
   * Check if any dependencies have been invalidated
   */
  private hasInvalidatedDependency(
    current: string[],
    cached?: string[],
  ): boolean {
    if (!cached) return false;

    // Check if dependencies changed
    if (current.length !== cached.length) return true;

    return current.some((dep) => !cached.includes(dep));
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.log.debug({ key }, "Cache invalidated");

    // Trigger hooks
    const hooks = this.invalidationHooks.get(key);
    if (hooks) {
      hooks.forEach((hook) => hook());
    }
  }

  /**
   * Invalidate by pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.log.debug({ pattern: pattern.toString(), count }, "Pattern invalidation");
  }

  /**
   * Register invalidation hook
   */
  onInvalidate(key: string, hook: () => void): () => void {
    if (!this.invalidationHooks.has(key)) {
      this.invalidationHooks.set(key, new Set());
    }

    this.invalidationHooks.get(key)!.add(hook);

    // Return unsubscribe function
    return () => {
      this.invalidationHooks.get(key)?.delete(hook);
    };
  }

  /**
   * Clear unused cache (TTL-based)
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        pruned++;
      }
    }

    this.log.debug({ pruned }, "Cache pruned");
    return pruned;
  }

  /**
   * Enforce max cache size
   */
  private enforceMaxSize(): void {
    if (this.cache.size <= this.config.maxEntries) return;

    // Remove oldest entries
    const sorted = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toRemove = this.cache.size - this.config.maxEntries;
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(sorted[i][0]);
    }

    this.log.debug({ removed: toRemove }, "Cache size enforced");
  }

  /**
   * Get cache stats
   */
  getStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.value).length;
      if (entry.expiresAt < now) {
        expiredCount++;
      }
    }

    return {
      entries: this.cache.size,
      totalSizeBytes: totalSize,
      expiredCount,
      ttlMs: this.config.ttlMs,
      maxEntries: this.config.maxEntries,
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.invalidationHooks.clear();
    this.log.debug("Cache cleared");
  }
}
