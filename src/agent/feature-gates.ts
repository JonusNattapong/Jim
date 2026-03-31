/**
 * Feature Gating System - Conditional feature loading and testing
 * Pattern: Inspired by Claude Code's feature gating with dead code elimination
 * 
 * Features:
 * - Runtime feature flags
 * - Bundle-time dead code elimination
 * - Feature experiments and A/B testing
 * - Telemetry and analytics
 */

import { childLogger } from "../utils/logger.js";

export type FeatureFlag = "streaming_executor" | "enhanced_permissions" | "cache_manager" | "vector_search" | "parallel_agents" | "voice_input" | "skill_system";

export interface FeatureConfig {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100: percentage of users
  experimentId?: string;
  metadata?: Record<string, unknown>;
}

export interface FeatureUsageMetrics {
  enabled: number;
  disabled: number;
  experiments: Map<string, { enabled: number; disabled: number }>;
}

/**
 * Feature gate manager
 */
export class FeatureGateManager {
  private flags: Map<string, FeatureConfig> = new Map();
  private metrics: FeatureUsageMetrics = {
    enabled: 0,
    disabled: 0,
    experiments: new Map(),
  };
  private userId: string;
  private log = childLogger({ component: "FeatureGateManager" });

  constructor(userId?: string) {
    this.userId = userId ?? "default";
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaults: Record<FeatureFlag, FeatureConfig> = {
      streaming_executor: {
        enabled: true,
        rolloutPercentage: 100,
      },
      enhanced_permissions: {
        enabled: true,
        rolloutPercentage: 80,
      },
      cache_manager: {
        enabled: true,
        rolloutPercentage: 100,
      },
      vector_search: {
        enabled: false,
        rolloutPercentage: 10,
      },
      parallel_agents: {
        enabled: true,
        rolloutPercentage: 50,
      },
      voice_input: {
        enabled: false,
        rolloutPercentage: 20,
      },
      skill_system: {
        enabled: true,
        rolloutPercentage: 90,
      },
    };

    for (const [flag, config] of Object.entries(defaults)) {
      this.flags.set(flag as FeatureFlag, config);
    }
  }

  /**
   * Check if feature is enabled for current user
   */
  isEnabled(flag: FeatureFlag): boolean {
    const config = this.flags.get(flag);
    if (!config) {
      this.log.warn({ flag }, "Feature flag not found");
      return false;
    }

    if (!config.enabled) {
      this.metrics.disabled++;
      return false;
    }

    // Check rollout percentage
    if (config.rolloutPercentage !== undefined) {
      const hash = this.hashUserId(this.userId);
      const percentage = (hash % 100) + 1;

      if (percentage > config.rolloutPercentage) {
        this.metrics.disabled++;
        return false;
      }
    }

    this.metrics.enabled++;

    // Track experiment
    if (config.experimentId) {
      if (!this.metrics.experiments.has(config.experimentId)) {
        this.metrics.experiments.set(config.experimentId, { enabled: 0, disabled: 0 });
      }
      const exp = this.metrics.experiments.get(config.experimentId)!;
      exp.enabled++;
    }

    return true;
  }

  /**
   * Hash user ID for consistent rollout
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set feature flag override
   */
  setFlag(flag: FeatureFlag, config: FeatureConfig): void {
    this.flags.set(flag, config);
    this.log.debug(
      { flag, enabled: config.enabled, rollout: config.rolloutPercentage },
      "Feature flag updated",
    );
  }

  /**
   * Get current flag configuration
   */
  getFlag(flag: FeatureFlag): FeatureConfig | undefined {
    return this.flags.get(flag);
  }

  /**
   * Get all flags
   */
  getAllFlags(): Record<string, FeatureConfig> {
    const result: Record<string, FeatureConfig> = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Run code conditionally based on feature flag
   */
  async runIfEnabled<T>(
    flag: FeatureFlag,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (this.isEnabled(flag)) {
      try {
        return await fn();
      } catch (err) {
        this.log.error(
          { flag, error: err instanceof Error ? err.message : String(err) },
          "Feature function failed",
        );
        if (fallback) {
          return await fallback();
        }
        throw err;
      }
    }

    if (fallback) {
      return await fallback();
    }

    throw new Error(`Feature ${flag} is not enabled`);
  }

  /**
   * Get usage metrics
   */
  getMetrics(): FeatureUsageMetrics {
    return {
      enabled: this.metrics.enabled,
      disabled: this.metrics.disabled,
      experiments: new Map(this.metrics.experiments),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      enabled: 0,
      disabled: 0,
      experiments: new Map(),
    };
  }

  /**
   * Get feature readiness report
   */
  getReadinessReport(): Record<string, { enabled: boolean; rollout: number; ready: boolean }> {
    const report: Record<string, { enabled: boolean; rollout: number; ready: boolean }> = {};

    for (const [flag, config] of this.flags) {
      report[flag] = {
        enabled: config.enabled,
        rollout: config.rolloutPercentage ?? 0,
        ready:
          config.enabled &&
          (config.rolloutPercentage === undefined || config.rolloutPercentage === 100),
      };
    }

    return report;
  }
}

/**
 * Global feature gate instance
 */
let globalFeatureGates: FeatureGateManager | null = null;

export function initializeFeatureGates(userId?: string): FeatureGateManager {
  globalFeatureGates = new FeatureGateManager(userId);
  return globalFeatureGates;
}

export function getFeatureGates(): FeatureGateManager {
  if (!globalFeatureGates) {
    globalFeatureGates = new FeatureGateManager();
  }
  return globalFeatureGates;
}

/**
 * Convenience function for checking features
 */
export function feature(flag: FeatureFlag): boolean {
  return getFeatureGates().isEnabled(flag);
}
