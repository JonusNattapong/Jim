/**
 * Enhanced Permission & Security Policy - Multi-layer permission rules
 * Pattern: Inspired by Claude Code's multi-layer security policies
 * 
 * Features:
 * - Multi-layer rules indexed by source (user/project/policy)
 * - Tool-specific security layers
 * - Behavior rules (allow/deny/ask)
 * - Permission tracking and auditing
 */

import type { PermissionMode } from "./manager.js";
import { childLogger } from "../utils/logger.js";

export type PermissionSource = "user" | "project" | "policy" | "cli";
export type PermissionBehavior = "allow" | "deny" | "ask";
export type ResourceType = "file" | "command" | "tool" | "network" | "system";

export interface PermissionRule {
  id: string;
  source: PermissionSource;
  resource: ResourceType;
  pattern: string | RegExp;
  behavior: PermissionBehavior;
  reason?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
  // Optional rule priority within a policy (higher = stronger)
  priority?: number;
  // Optional synchronous predicate to evaluate contextual state
  predicate?: (context: PermissionContext) => boolean;
  // Optional time-window when this rule applies (HH:MM local time)
  timeWindow?: {
    start: string; // e.g. "09:00"
    end: string; // e.g. "17:30"
    days?: number[]; // 0=Sunday .. 6=Saturday
    tz?: string; // timezone string (not used - local time assumed)
  };
  // Optional maximum times this rule can be used before it expires
  maxUses?: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: PermissionRule[];
  priority: number; // Higher = takes precedence
  enabled: boolean;
}

export interface PermissionContext {
  source: PermissionSource;
  resource: ResourceType;
  target: string;
  toolName?: string;
  reasons?: string[];
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
  matchedRule?: PermissionRule;
  matchedPolicyId?: string;
  requiresApproval: boolean;
}

export interface PermissionAuditLog {
  timestamp: number;
  context: PermissionContext;
  decision: PermissionDecision;
  approved?: boolean;
  denialReason?: string;
}

/**
 * Enhanced permission system with multi-layer policies
 */
export class SecurityPolicyManager {
  private policies: Map<string, SecurityPolicy> = new Map();
  private auditLog: PermissionAuditLog[] = [];
  private denialHistory: Map<string, number> = new Map();
  private ruleUses: Map<string, number> = new Map();
  private maxAuditLogs: number = 1000;
  private log = childLogger({ component: "SecurityPolicyManager" });

  /**
   * Register a security policy
   */
  registerPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
    this.log.debug({ policyId: policy.id, name: policy.name }, "Security policy registered");
  }

  /**
   * Check permission against all policies
   */
  checkPermission(context: PermissionContext): PermissionDecision {
    // Purge expired/overused rules before evaluation
    this.purgeExpiredRules();

    // Get enabled policies sorted by priority
    const activePolicies = Array.from(this.policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    let finalDecision: PermissionDecision | null = null;
    let firstMatchedRule: PermissionRule | null = null;

    // Check rules in order of policy priority
    for (const policy of activePolicies) {
      // Sort rules by optional rule-level priority, then definition order
      const rules = [...policy.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      for (const rule of rules) {
        if (this.ruleMatches(rule, context)) {
          if (!firstMatchedRule) firstMatchedRule = rule;

          const allowed = rule.behavior === "allow";
          const requiresApproval = rule.behavior === "ask";

          finalDecision = {
            allowed: allowed || requiresApproval,
            reason: rule.reason ?? `Rule "${rule.id}" matched`,
            matchedRule: rule,
            matchedPolicyId: policy.id,
            requiresApproval,
          };

          // Increment use counter for this rule (only when it produced a decision)
          this.incrementRuleUse(rule.id);

          if (rule.behavior !== "ask") {
            break; // Definitive rule found
          }
        }
      }

      if (finalDecision?.matchedRule?.behavior !== "ask") {
        break; // Definitive decision made
      }
    }

    // Default: deny
    if (!finalDecision) {
      finalDecision = {
        allowed: false,
        reason: "No matching permission rule found",
        requiresApproval: false,
      };
    }

    // Log decision
    this.logDecision(context, finalDecision);

    // Track denials
    if (!finalDecision.allowed) {
      const key = `${context.toolName}:${context.target}`;
      this.denialHistory.set(key, (this.denialHistory.get(key) ?? 0) + 1);
    }

    return finalDecision;
  }

  /**
   * Check if a rule matches the permission context
   */
  private ruleMatches(rule: PermissionRule, context: PermissionContext): boolean {
    // Check expiration
    if (rule.expiresAt && rule.expiresAt < Date.now()) {
      return false;
    }

    // Check maxUses
    if (rule.maxUses) {
      const used = this.ruleUses.get(rule.id) ?? 0;
      if (used >= rule.maxUses) return false;
    }

    // Check resource type
    if (rule.resource !== context.resource) {
      return false;
    }

    // Check pattern matching
    const pattern =
      typeof rule.pattern === "string"
        ? new RegExp(rule.pattern)
        : rule.pattern;

    if (!pattern.test(context.target)) return false;

    // Evaluate optional synchronous predicate
    if (rule.predicate) {
      try {
        const ok = rule.predicate(context);
        if (!ok) return false;
      } catch (err) {
        this.log.warn({ ruleId: rule.id, err: String(err) }, "Predicate threw an error; skipping rule");
        return false;
      }
    }

    // Evaluate optional time window
    if (rule.timeWindow) {
      if (!this.timeWindowMatches(rule.timeWindow)) return false;
    }

    return true;
  }

  /**
   * Check whether the current local time matches a rule's time window.
   */
  private timeWindowMatches(tw: NonNullable<PermissionRule['timeWindow']>): boolean {
    try {
      const now = new Date();
      if (tw.days && tw.days.length > 0) {
        if (!tw.days.includes(now.getDay())) return false;
      }

      const [ss, sm] = tw.start.split(":").map((s) => parseInt(s, 10));
      const [es, em] = tw.end.split(":").map((s) => parseInt(s, 10));

      const startMinutes = ss * 60 + sm;
      const endMinutes = es * 60 + em;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
      }

      // Overnight window (e.g., 22:00-04:00)
      return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
    } catch (err) {
      this.log.warn({ err: String(err), timeWindow: tw }, "Failed to evaluate time window - rejecting rule");
      return false;
    }
  }

  /**
   * Increment usage counter for a rule id
   */
  private incrementRuleUse(ruleId: string): void {
    this.ruleUses.set(ruleId, (this.ruleUses.get(ruleId) ?? 0) + 1);
  }

  /**
   * Remove expired or over-used rules from policies
   */
  purgeExpiredRules(): void {
    const now = Date.now();
    for (const policy of this.policies.values()) {
      const before = policy.rules.length;
      policy.rules = policy.rules.filter((r) => {
        if (r.expiresAt && r.expiresAt < now) return false;
        if (r.maxUses) {
          const used = this.ruleUses.get(r.id) ?? 0;
          if (used >= r.maxUses) return false;
        }
        return true;
      });

      if (policy.rules.length !== before) {
        this.log.info({ policyId: policy.id }, "Purged expired/overused rules from policy");
      }
    }
  }

  /**
   * Get usage count for a rule id
   */
  getRuleUsage(ruleId: string): number {
    return this.ruleUses.get(ruleId) ?? 0;
  }

  /**
   * Log permission decision
   */
  private logDecision(
    context: PermissionContext,
    decision: PermissionDecision,
  ): void {
    const log: PermissionAuditLog = {
      timestamp: Date.now(),
      context,
      decision,
    };

    this.auditLog.push(log);
    if (this.auditLog.length > this.maxAuditLogs) {
      this.auditLog.shift();
    }

    const level = decision.allowed ? "debug" : "warn";
    this.log[level](
      {
        tool: context.toolName,
        target: context.target,
        allowed: decision.allowed,
        reason: decision.reason,
        matchedPolicyId: decision.matchedPolicyId,
        matchedRuleId: decision.matchedRule?.id,
      },
      "Permission check",
    );
  }

  /**
   * Approve a previously pending decision
   */
  approveDecision(logIndex: number): void {
    if (logIndex < 0 || logIndex >= this.auditLog.length) {
      throw new Error("Invalid audit log index");
    }

    this.auditLog[logIndex].approved = true;
    this.log.info(
      { target: this.auditLog[logIndex].context.target },
      "Permission approved",
    );
  }

  /**
   * Deny a decision with reason
   */
  denyDecision(logIndex: number, reason: string): void {
    if (logIndex < 0 || logIndex >= this.auditLog.length) {
      throw new Error("Invalid audit log index");
    }

    this.auditLog[logIndex].approved = false;
    this.auditLog[logIndex].denialReason = reason;
    this.log.info(
      { target: this.auditLog[logIndex].context.target, reason },
      "Permission denied",
    );
  }

  /**
   * Get audit log for specific tool or resource
   */
  getAuditLog(
    toolName?: string,
    limit: number = 50,
  ): PermissionAuditLog[] {
    let filtered = this.auditLog;

    if (toolName) {
      filtered = filtered.filter((log) => log.context.toolName === toolName);
    }

    return filtered.slice(-limit);
  }

  /**
   * Get denial statistics
   */
  getDenialStats() {
    const stats: Record<string, { count: number; lastOccurrence: number }> = {};

    for (const log of this.auditLog) {
      if (!log.decision.allowed) {
        const key = `${log.context.toolName}:${log.context.target}`;
        stats[key] = {
          count: (stats[key]?.count ?? 0) + 1,
          lastOccurrence: log.timestamp,
        };
      }
    }

    return stats;
  }

  /**
   * Get policy summary
   */
  getPolicySummary() {
    return Array.from(this.policies.values()).map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      ruleCount: p.rules.length,
    }));
  }

  /**
   * Enable/disable policy
   */
  setPolicyEnabled(policyId: string, enabled: boolean): void {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    policy.enabled = enabled;
    this.log.info(
      { policyId, enabled },
      "Policy status updated",
    );
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.denialHistory.clear();
    this.log.info("Audit log cleared");
  }

  /**
   * Add a rule to an existing policy. Throws if policy not found.
   */
  addRuleToPolicy(policyId: string, rule: PermissionRule): void {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error(`Policy not found: ${policyId}`);
    policy.rules.push(rule);
    this.log.info({ policyId, ruleId: rule.id }, "Rule added to policy");
  }

  /**
   * Remove a rule from a policy by id
   */
  removeRuleFromPolicy(policyId: string, ruleId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;
    const before = policy.rules.length;
    policy.rules = policy.rules.filter((r) => r.id !== ruleId);
    const removed = policy.rules.length !== before;
    if (removed) this.log.info({ policyId, ruleId }, "Rule removed from policy");
    return removed;
  }

  /**
   * Find a rule by id across all policies
   */
  findRule(ruleId: string): { policyId: string; rule: PermissionRule } | undefined {
    for (const policy of this.policies.values()) {
      const r = policy.rules.find((x) => x.id === ruleId);
      if (r) return { policyId: policy.id, rule: r };
    }
    return undefined;
  }
}
