/**
 * Error Handler & Categorization - Error categorization with recovery strategies
 * Pattern: Inspired by Claude Code's comprehensive error handling
 * 
 * Handles:
 * - Error categorization (network, timeout, permission, API, etc.)
 * - Recovery strategies with fallbacks
 * - Error tracking and analytics
 * - User-friendly error messages
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { childLogger } from "../utils/logger.js";

export type ErrorCategory =
  | "network"
  | "timeout"
  | "permission"
  | "validation"
  | "api"
  | "not_found"
  | "rate_limit"
  | "token_overflow"
  | "tool"
  | "unknown";

export type RecoveryStrategy =
  | "retry"
  | "fallback"
  | "compact"
  | "skip"
  | "abort";

export interface AgentError {
  category: ErrorCategory;
  message: string;
  originalError: Error;
  toolName?: string;
  timestamp: number;
  recoveryStrategy?: RecoveryStrategy;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface RecoveryAction {
  strategy: RecoveryStrategy;
  action: () => Promise<unknown>;
  description: string;
}

/**
 * Error categorization logic
 */
function categorizeError(err: unknown, toolName?: string): ErrorCategory {
  if (!(err instanceof Error)) {
    return "unknown";
  }

  const msg = err.message.toLowerCase();
  const name = err.name.toLowerCase();

  // Network errors
  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    name.includes("networkerror")
  ) {
    return "network";
  }

  // Timeout errors
  if (
    msg.includes("timeout") ||
    msg.includes("deadline") ||
    msg.includes("etimedout")
  ) {
    return "timeout";
  }

  // Permission errors
  if (
    msg.includes("permission") ||
    msg.includes("denied") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden")
  ) {
    return "permission";
  }

  // Validation errors
  if (
    msg.includes("validation") ||
    msg.includes("schema") ||
    msg.includes("invalid")
  ) {
    return "validation";
  }

  // Token overflow
  if (msg.includes("token") || msg.includes("context_length")) {
    return "token_overflow";
  }

  // Rate limiting
  if (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("too_many_requests")
  ) {
    return "rate_limit";
  }

  // Not found
  if (msg.includes("not found") || msg.includes("404")) {
    return "not_found";
  }

  // API errors
  if (msg.includes("api") || name.includes("apierror")) {
    return "api";
  }

  // Tool specific
  if (toolName) {
    return "tool";
  }

  return "unknown";
}

/**
 * Determine recovery strategy for different error categories
 */
function getDefaultRecoveryStrategy(category: ErrorCategory): RecoveryStrategy {
  switch (category) {
    case "timeout":
    case "network":
    case "rate_limit":
      return "retry";

    case "token_overflow":
      return "compact";

    case "permission":
    case "not_found":
      return "skip";

    case "validation":
    case "tool":
      return "abort";

    case "api":
      return "fallback";

    default:
      return "retry";
  }
}

/**
 * User-friendly error messages
 */
function getUserFriendlyMessage(error: AgentError): string {
  const { category, message, toolName, retryCount = 0 } = error;

  switch (category) {
    case "timeout":
      return `⏱️ Request timed out${toolName ? ` (${toolName})` : ""}. Please try again.`;

    case "network":
      return `🌐 Network error. Please check your connection and try again.`;

    case "rate_limit":
      return `⚠️ Rate limited. Waiting before retry (attempt ${retryCount + 1}...)`;

    case "permission":
      return `🔒 Permission denied. You may not have access to this resource.`;

    case "token_overflow":
      return `💾 Token limit exceeded. Compacting conversation history...`;

    case "not_found":
      return `❌ Resource not found: ${message}`;

    case "validation":
      return `📋 Invalid input: ${message}`;

    case "tool":
      return `🔧 Tool error${toolName ? ` (${toolName})` : ""}: ${message}`;

    case "api":
      return `🤖 API error: ${message}`;

    default:
      return `❌ Error: ${message}`;
  }
}

/**
 * Error handler with recovery strategies
 */
export class ErrorHandler {
  private errors: AgentError[] = [];
  private maxErrors: number = 100;
  private log = childLogger({ component: "ErrorHandler" });

  /**
   * Handle an error with categorization and recovery
   */
  handleError(
    err: unknown,
    toolName?: string,
  ): AgentError {
    const category = categorizeError(err, toolName);
    const message =
      err instanceof Error ? err.message : String(err);

    const agentError: AgentError = {
      category,
      message,
      originalError: err instanceof Error ? err : new Error(message),
      toolName,
      timestamp: Date.now(),
      recoveryStrategy: getDefaultRecoveryStrategy(category),
    };

    // Track error
    this.errors.push(agentError);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.log.warn(
      { category, toolName, message },
      getUserFriendlyMessage(agentError),
    );

    return agentError;
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(error: AgentError): boolean {
    return (
      error.category === "timeout" ||
      error.category === "network" ||
      error.category === "rate_limit"
    );
  }

  /**
   * Check if context needs compaction
   */
  needsCompaction(
    error: AgentError,
    messages: ChatCompletionMessageParam[],
  ): boolean {
    return (
      error.category === "token_overflow" &&
      messages.length > 10
    );
  }

  /**
   * Get recovery actions for error
   */
  getRecoveryActions(error: AgentError): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    if (this.isRetryable(error)) {
      actions.push({
        strategy: "retry",
        action: async () => {
          // Retry logic will be implemented in agent loop
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, error.retryCount ?? 0) * 100),
          );
        },
        description: `Retry ${error.toolName ? `${error.toolName}` : "operation"}`,
      });
    }

    if (error.category === "token_overflow") {
      actions.push({
        strategy: "compact",
        action: async () => {
          this.log.info("Compacting context to recover from token overflow");
        },
        description: "Compact conversation history",
      });
    }

    if (error.category === "rate_limit") {
      actions.push({
        strategy: "fallback",
        action: async () => {
          this.log.info("Attempting fallback strategy for rate limit");
        },
        description: "Use fallback model or method",
      });
    }

    return actions;
  }

  /**
   * Get error summary
   */
  getSummary() {
    const grouped = new Map<ErrorCategory, number>();

    for (const err of this.errors) {
      grouped.set(
        err.category,
        (grouped.get(err.category) ?? 0) + 1,
      );
    }

    return {
      totalErrors: this.errors.length,
      byCategory: Object.fromEntries(grouped),
      recentErrors: this.errors.slice(-10),
    };
  }

  /**
   * Clear error history
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get user-friendly message for error
   */
  formatErrorMessage(error: AgentError): string {
    return getUserFriendlyMessage(error);
  }
}
