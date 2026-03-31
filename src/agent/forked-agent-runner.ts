/**
 * Forked Agent Cache-Safe Params - Post-turn operations reuse cache safely
 * Pattern: Claude Code allows sub-agents to share caches after parent turn
 * 
 * Problem: Sub-agents create new agents, missing cache from parent turn
 * Solution: Pass cache-safe parameters that allow cache sharing after turn end
 */

import type { ContextCacheManager } from "./cache-manager.js";
import { childLogger } from "../utils/logger.js";

export interface CacheSafeParams {
  // Don't pass raw cache manager - pass explicit cache keys
  cachedContextKeys: string[];
  cachedRepoMap?: string; // Serialized repo map
  cachedGitStatus?: string; // Serialized git status
  cursorState?: {
    activeFile?: string;
    line?: number;
  };
  // Metadata about what was cached
  cacheMetadata: {
    timestamp: number;
    parentSessionId: string;
    cacheGeneration: number; // Prevent stale cache reuse
  };
}

export interface ForkedAgentConfig {
  parentSessionId: string;
  cacheSafeParams?: CacheSafeParams;
  inheritCache: boolean; // Allow cache reuse
}

/**
 * Create cache-safe parameters from current turn
 */
export function createCacheSafeParams(
  cacheManager: ContextCacheManager,
  parentSessionId: string,
  generation: number,
): CacheSafeParams {
  // Get keys of currently cached items
  const cachedContextKeys: string[] = [];
  
  // Simulate getting cache keys (in real impl, expose from ContextCacheManager)
  // For now, we document the pattern

  return {
    cachedContextKeys,
    cacheMetadata: {
      timestamp: Date.now(),
      parentSessionId,
      cacheGeneration: generation,
    },
  };
}

/**
 * Forked agent runner that can reuse parent cache
 */
export class ForkedAgentRunner {
  private config: ForkedAgentConfig;
  private log = childLogger({ component: "ForkedAgentRunner" });
  private cacheGeneration: number = 0;

  constructor(config: ForkedAgentConfig) {
    this.config = config;
  }

  /**
   * Run agent with optional cache reuse
   */
  async runForkedAgent<T>(
    fn: (params: CacheSafeParams | undefined) => Promise<T>,
  ): Promise<T> {
    try {
      // If we have cache-safe params and inheritance enabled, pass them
      if (this.config.inheritCache && this.config.cacheSafeParams) {
        this.log.debug(
          {
            parentSession: this.config.parentSessionId,
            cachedKeys: this.config.cacheSafeParams.cachedContextKeys.length,
          },
          "Running forked agent with parent cache",
        );

        return await fn(this.config.cacheSafeParams);
      }

      // No cache inheritance
      return await fn(undefined);
    } catch (err) {
      this.log.error(
        { error: err, parentSession: this.config.parentSessionId },
        "Forked agent failed",
      );
      throw err;
    }
  }

  /**
   * Validate cache params are still fresh
   */
  validateCacheParams(params: CacheSafeParams): {
    valid: boolean;
    reason?: string;
  } {
    const age = Date.now() - params.cacheMetadata.timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (age > maxAge) {
      return {
        valid: false,
        reason: `Cache too old (${Math.round(age / 1000)}s)`,
      };
    }

    if (params.cacheMetadata.parentSessionId !== this.config.parentSessionId) {
      return {
        valid: false,
        reason: "Cache from different session",
      };
    }

    return { valid: true };
  }

  /**
   * Restore cache state in forked agent
   */
  async restoreCacheState(
    params: CacheSafeParams,
    cacheManager: ContextCacheManager,
  ): Promise<void> {
    const validation = this.validateCacheParams(params);
    if (!validation.valid) {
      this.log.warn({ reason: validation.reason }, "Cache validation failed");
      return;
    }

    // Restore individual cache entries
    if (params.cachedRepoMap) {
      await cacheManager.get(
        "repo-map",
        async () => params.cachedRepoMap!,
      );
    }

    if (params.cachedGitStatus) {
      await cacheManager.get(
        "git-status",
        async () => params.cachedGitStatus!,
      );
    }

    this.log.debug("Cache state restored in forked agent");
  }
}

/**
 * Factory for creating forked agents with cache inheritance
 */
export class ForkedAgentFactory {
  private parentSessionId: string;
  private currentGeneration: number = 0;
  private log = childLogger({ component: "ForkedAgentFactory" });

  constructor(parentSessionId: string) {
    this.parentSessionId = parentSessionId;
  }

  /**
   * Create a forked agent config with current cache state
   */
  createForkedConfig(
    cacheManager?: ContextCacheManager,
    inheritCache: boolean = true,
  ): ForkedAgentConfig {
    const config: ForkedAgentConfig = {
      parentSessionId: this.parentSessionId,
      inheritCache,
    };

    if (inheritCache && cacheManager) {
      config.cacheSafeParams = createCacheSafeParams(
        cacheManager,
        this.parentSessionId,
        this.currentGeneration,
      );

      this.log.debug(
        {
          generation: this.currentGeneration,
          cacheKeys: config.cacheSafeParams.cachedContextKeys.length,
        },
        "Forked agent created with cache params",
      );
    }

    return config;
  }

  /**
   * Increment generation (call after parent turn completes)
   */
  nextGeneration(): void {
    this.currentGeneration++;
    this.log.debug(
      { generation: this.currentGeneration },
      "Cache generation incremented",
    );
  }

  /**
   * Get current generation
   */
  getGeneration(): number {
    return this.currentGeneration;
  }
}
