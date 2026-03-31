/**
 * Multi-Layer Permission Rule Engine
 * 
 * Inspired by Claude Code's permission system that indexes rules by source
 * and applies them in priority order. Allows project-level, workspace-level,
 * and global permissions to coexist with proper precedence.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Permission rule sources in priority order (highest to lowest)
 */
export type PermissionRuleSource =
  | "policySettings"    // Managed/enterprise policies (highest priority)
  | "cliArg"            // Command-line arguments
  | "userSettings"      // User-level settings
  | "projectSettings"   // Project-level settings
  | "localSettings"     // Local directory settings
  | "flagSettings"      // Feature flags
  | "command"           // Command context
  | "session";          // Session-specific rules (lowest priority)

/**
 * Ordered list of sources for priority application
 */
export const SETTING_SOURCES: readonly PermissionRuleSource[] = [
  "policySettings",
  "cliArg",
  "userSettings",
  "projectSettings",
  "localSettings",
  "flagSettings",
  "command",
  "session",
] as const;

/**
 * Permission behaviors
 */
export type PermissionBehavior = "allow" | "deny" | "ask";

/**
 * A single permission rule
 */
export interface PermissionRule {
  /** Tool name pattern (supports wildcards: "Bash", "Bash(*)", "*") */
  toolPattern: string;
  /** Behavior when this rule matches */
  behavior: PermissionBehavior;
  /** Optional input pattern for fine-grained matching */
  inputPattern?: string;
  /** Rule source */
  source: PermissionRuleSource;
  /** When this rule was added */
  addedAt: number;
  /** Optional reason for this rule */
  reason?: string;
}

/**
 * Permission rules indexed by source and behavior
 */
export interface PermissionRulesBySource {
  [source: string]: string[];
}

/**
 * Permission context with multi-layer rules
 */
export interface PermissionContext {
  /** Permission mode */
  mode: "default" | "plan" | "bypassPermissions" | "auto";
  /** Always-allow rules by source */
  alwaysAllowRules: PermissionRulesBySource;
  /** Always-deny rules by source */
  alwaysDenyRules: PermissionRulesBySource;
  /** Always-ask rules by source */
  alwaysAskRules: PermissionRulesBySource;
  /** Whether bypass mode is available */
  isBypassPermissionsModeAvailable: boolean;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  behavior: PermissionBehavior;
  matchedRule?: PermissionRule;
  matchedSource?: PermissionRuleSource;
  reason?: string;
}

// ============================================================================
// Dangerous Pattern Detection
// ============================================================================

/**
 * Patterns that indicate potentially dangerous operations
 */
const DANGEROUS_PATTERNS = [
  // Shell interpreters without specific commands
  /^python[:\s]/i,
  /^node[:\s]/i,
  /^ruby[:\s]/i,
  /^perl[:\s]/i,
  /^bash[:\s]/i,
  /^sh[:\s]/i,
  /^zsh[:\s]/i,
  /^pwsh[:\s]/i,
  /^powershell[:\s]/i,

  // Destructive commands
  /\brm\s+-rf\b/i,
  /\brm\s+-r\b/i,
  /\bdel\s+\/[sq]\b/i,
  /\bformat\b/i,
  /\bdd\b.*of=/i,

  // Network operations
  /\bcurl\b.*\|\s*(sh|bash)/i,
  /\bwget\b.*\|\s*(sh|bash)/i,

  // Privilege escalation
  /\bsudo\b/i,
  /\bsu\s/i,
  /\bchmod\s+777\b/i,
];

/**
 * Check if a permission rule contains dangerous patterns
 */
export function isDangerousPermission(
  toolName: string,
  ruleContent: string | undefined
): boolean {
  // Tool-level allow with no pattern → potentially dangerous
  if (toolName === "Bash" && !ruleContent) {
    return true;
  }

  if (!ruleContent) return false;

  // Check against dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(ruleContent)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Rule Matching
// ============================================================================

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert a rule pattern to a regex
 * Supports: "Bash", "Bash(git *)", "*", "Bash(*)"
 */
function patternToRegex(pattern: string): RegExp {
  // Handle "ToolName(input pattern)" format
  const match = pattern.match(/^([^(]+)\((.+)\)$/);
  if (match) {
    const [, toolName, inputPattern] = match;
    const escapedTool = escapeRegex(toolName.trim());
    // Convert * to .* for wildcard matching
    const escapedInput = escapeRegex(inputPattern).replace(/\\\*/g, ".*");
    return new RegExp(`^${escapedTool}\\(${escapedInput}\\)$`, "i");
  }

  // Handle wildcards
  if (pattern === "*") {
    return /^.*$/i;
  }

  // Handle "ToolName(*)" - match any input
  if (pattern.endsWith("(*)")) {
    const toolName = pattern.slice(0, -3);
    const escapedTool = escapeRegex(toolName);
    return new RegExp(`^${escapedTool}\\(.*\\)$`, "i");
  }

  // Exact match
  const escaped = escapeRegex(pattern);
  return new RegExp(`^${escaped}$`, "i");
}

/**
 * Check if a rule pattern matches a tool invocation
 */
export function ruleMatches(
  rulePattern: string,
  toolName: string,
  input?: Record<string, unknown>
): boolean {
  // Simple tool name match
  if (rulePattern === toolName) {
    return true;
  }

  // Wildcard match
  if (rulePattern === "*") {
    return true;
  }

  // Pattern with input
  const fullInvocation = input
    ? `${toolName}(${JSON.stringify(input)})`
    : toolName;

  const regex = patternToRegex(rulePattern);
  return regex.test(fullInvocation);
}

// ============================================================================
// Rule Engine
// ============================================================================

/**
 * Multi-layer permission rule engine
 */
export class PermissionRuleEngine {
  private rules: Map<PermissionRuleSource, PermissionRule[]> = new Map();
  private auditLog: Array<{
    timestamp: number;
    toolName: string;
    result: PermissionCheckResult;
  }> = [];

  constructor() {
    // Initialize empty rule lists for each source
    for (const source of SETTING_SOURCES) {
      this.rules.set(source, []);
    }
  }

  /**
   * Add a permission rule from a specific source
   */
  addRule(
    source: PermissionRuleSource,
    rule: Omit<PermissionRule, "source" | "addedAt">
  ): void {
    const fullRule: PermissionRule = {
      ...rule,
      source,
      addedAt: Date.now(),
    };

    const sourceRules = this.rules.get(source) ?? [];
    sourceRules.push(fullRule);
    this.rules.set(source, sourceRules);
  }

  /**
   * Add multiple rules from a source
   */
  addRules(
    source: PermissionRuleSource,
    rules: Array<Omit<PermissionRule, "source" | "addedAt">>
  ): void {
    for (const rule of rules) {
      this.addRule(source, rule);
    }
  }

  /**
   * Remove all rules from a source
   */
  clearRules(source: PermissionRuleSource): void {
    this.rules.set(source, []);
  }

  /**
   * Remove a specific rule
   */
  removeRule(source: PermissionRuleSource, toolPattern: string): boolean {
    const sourceRules = this.rules.get(source) ?? [];
    const index = sourceRules.findIndex((r) => r.toolPattern === toolPattern);
    if (index >= 0) {
      sourceRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check permission for a tool invocation
   * Applies rules in priority order (policySettings > cliArg > userSettings > ...)
   */
  checkPermission(
    toolName: string,
    input?: Record<string, unknown>
  ): PermissionCheckResult {
    // Check each source in priority order
    for (const source of SETTING_SOURCES) {
      const sourceRules = this.rules.get(source) ?? [];

      for (const rule of sourceRules) {
        if (ruleMatches(rule.toolPattern, toolName, input)) {
          const result: PermissionCheckResult = {
            behavior: rule.behavior,
            matchedRule: rule,
            matchedSource: source,
            reason: rule.reason,
          };

          // Log to audit trail
          this.auditLog.push({
            timestamp: Date.now(),
            toolName,
            result,
          });

          // First match wins (priority order)
          return result;
        }
      }
    }

    // No rule matched - default to ask
    const defaultResult: PermissionCheckResult = {
      behavior: "ask",
      reason: "No permission rule matched",
    };

    this.auditLog.push({
      timestamp: Date.now(),
      toolName,
      result: defaultResult,
    });

    return defaultResult;
  }

  /**
   * Get all rules for a specific source
   */
  getRules(source: PermissionRuleSource): PermissionRule[] {
    return this.rules.get(source) ?? [];
  }

  /**
   * Get all rules across all sources
   */
  getAllRules(): PermissionRule[] {
    const all: PermissionRule[] = [];
    for (const source of SETTING_SOURCES) {
      all.push(...(this.rules.get(source) ?? []));
    }
    return all;
  }

  /**
   * Get the audit log
   */
  getAuditLog(
    options?: {
      toolName?: string;
      since?: number;
      limit?: number;
    }
  ): typeof this.auditLog {
    let filtered = this.auditLog;

    if (options?.toolName) {
      filtered = filtered.filter((e) => e.toolName === options.toolName);
    }

    if (options?.since) {
      filtered = filtered.filter((e) => e.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get permission statistics
   */
  getStats(): {
    totalChecks: number;
    allowed: number;
    denied: number;
    asked: number;
    bySource: Record<PermissionRuleSource, number>;
  } {
    const stats = {
      totalChecks: this.auditLog.length,
      allowed: 0,
      denied: 0,
      asked: 0,
      bySource: {} as Record<PermissionRuleSource, number>,
    };

    for (const entry of this.auditLog) {
      switch (entry.result.behavior) {
        case "allow":
          stats.allowed++;
          break;
        case "deny":
          stats.denied++;
          break;
        case "ask":
          stats.asked++;
          break;
      }

      if (entry.result.matchedSource) {
        stats.bySource[entry.result.matchedSource] =
          (stats.bySource[entry.result.matchedSource] ?? 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Export rules to a serializable format
   */
  exportRules(): Record<PermissionRuleSource, PermissionRule[]> {
    const exported: Record<string, PermissionRule[]> = {};
    for (const [source, rules] of this.rules) {
      exported[source] = rules;
    }
    return exported as Record<PermissionRuleSource, PermissionRule[]>;
  }

  /**
   * Import rules from a serialized format
   */
  importRules(data: Record<string, PermissionRule[]>): void {
    for (const [source, rules] of Object.entries(data)) {
      if (SETTING_SOURCES.includes(source as PermissionRuleSource)) {
        this.rules.set(source as PermissionRuleSource, rules);
      }
    }
  }
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Build a permission context from various sources
 */
export function buildPermissionContext(sources: {
  userSettings?: PermissionRulesBySource;
  projectSettings?: PermissionRulesBySource;
  cliArgs?: string[];
  mode?: PermissionContext["mode"];
}): PermissionContext {
  const context: PermissionContext = {
    mode: sources.mode ?? "default",
    alwaysAllowRules: {},
    alwaysDenyRules: {},
    alwaysAskRules: {},
    isBypassPermissionsModeAvailable: sources.mode === "bypassPermissions",
  };

  // Merge user settings
  if (sources.userSettings) {
    for (const [key, rules] of Object.entries(sources.userSettings)) {
      context.alwaysAllowRules[key] = rules;
    }
  }

  // Merge project settings
  if (sources.projectSettings) {
    for (const [key, rules] of Object.entries(sources.projectSettings)) {
      context.alwaysAllowRules[key] = [
        ...(context.alwaysAllowRules[key] ?? []),
        ...rules,
      ];
    }
  }

  return context;
}

// ============================================================================
// Exports
// ============================================================================

export const PermissionRules = {
  PermissionRuleEngine,
  isDangerousPermission,
  ruleMatches,
  buildPermissionContext,
  SETTING_SOURCES,
} as const;