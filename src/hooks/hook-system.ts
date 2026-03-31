/**
 * Hook System - Lifecycle Event Framework
 * 
 * Inspired by Claude Code's hook system that allows custom logic
 * at specific points in the agent loop (PreToolUse, PostToolUse, etc.)
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Hook event types (27 events from Claude Code)
 */
export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "StopFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PostCompact"
  | "PermissionRequest"
  | "PermissionDenied"
  | "Setup"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  | "FileChanged"
  | "CwdChanged";

/**
 * Hook types - how hooks are executed
 */
export type HookType = "command" | "prompt" | "function";

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Hook event to trigger on */
  event: HookEvent;
  /** Type of hook execution */
  type: HookType;
  /** Command to run (for command type) */
  command?: string;
  /** Prompt to send (for prompt type) */
  prompt?: string;
  /** Function to call (for function type) */
  handler?: HookHandler;
  /** Optional condition to check before running */
  condition?: (context: HookContext) => boolean;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Whether to block the agent loop until hook completes */
  blocking?: boolean;
}

/**
 * Hook context passed to handlers
 */
export interface HookContext {
  event: HookEvent;
  timestamp: number;
  sessionId: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Hook handler function
 */
export type HookHandler = (context: HookContext) => Promise<HookResult>;

/**
 * Hook execution result
 */
export interface HookResult {
  success: boolean;
  output?: string;
  error?: string;
  shouldContinue?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Hook registration
 */
export interface HookRegistration {
  id: string;
  config: HookConfig;
  registeredAt: number;
}

// ============================================================================
// Hook System
// ============================================================================

/**
 * Manages lifecycle hooks for the agent loop
 */
export class HookSystem {
  private hooks: Map<HookEvent, HookRegistration[]> = new Map();
  private executionLog: Array<{
    hookId: string;
    event: HookEvent;
    result: HookResult;
    durationMs: number;
    timestamp: number;
  }> = [];

  constructor() {
    // Initialize empty arrays for all events
    const events: HookEvent[] = [
      "PreToolUse", "PostToolUse", "PostToolUseFailure",
      "Notification", "UserPromptSubmit", "SessionStart", "SessionEnd",
      "Stop", "StopFailure", "SubagentStart", "SubagentStop",
      "PreCompact", "PostCompact", "PermissionRequest", "PermissionDenied",
      "Setup", "TeammateIdle", "TaskCreated", "TaskCompleted",
      "FileChanged", "CwdChanged",
    ];
    for (const event of events) {
      this.hooks.set(event, []);
    }
  }

  /**
   * Register a hook for an event
   */
  register(config: HookConfig): string {
    const id = `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const registration: HookRegistration = {
      id,
      config,
      registeredAt: Date.now(),
    };

    const eventHooks = this.hooks.get(config.event) ?? [];
    eventHooks.push(registration);
    this.hooks.set(config.event, eventHooks);

    return id;
  }

  /**
   * Unregister a hook
   */
  unregister(hookId: string): boolean {
    for (const [event, hooks] of this.hooks) {
      const index = hooks.findIndex((h) => h.id === hookId);
      if (index >= 0) {
        hooks.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Unregister all hooks for an event
   */
  unregisterAll(event: HookEvent): void {
    this.hooks.set(event, []);
  }

  /**
   * Execute all hooks for an event
   */
  async execute(
    event: HookEvent,
    context: Omit<HookContext, "event" | "timestamp">
  ): Promise<HookResult[]> {
    const hooks = this.hooks.get(event) ?? [];
    if (hooks.length === 0) return [];

    const fullContext: HookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };

    const results: HookResult[] = [];

    for (const hook of hooks) {
      // Check condition if provided
      if (hook.config.condition && !hook.config.condition(fullContext)) {
        continue;
      }

      const startTime = Date.now();

      try {
        let result: HookResult;

        switch (hook.config.type) {
          case "function":
            if (hook.config.handler) {
              result = await this.executeWithTimeout(
                hook.config.handler(fullContext),
                hook.config.timeoutMs ?? 30_000
              );
            } else {
              result = { success: false, error: "No handler provided" };
            }
            break;

          case "command":
            result = await this.executeCommand(
              hook.config.command ?? "",
              fullContext
            );
            break;

          case "prompt":
            result = { success: true, output: hook.config.prompt };
            break;

          default:
            result = { success: false, error: `Unknown hook type: ${hook.config.type}` };
        }

        const durationMs = Date.now() - startTime;

        // Log execution
        this.executionLog.push({
          hookId: hook.id,
          event,
          result,
          durationMs,
          timestamp: Date.now(),
        });

        results.push(result);

        // If blocking hook fails and shouldContinue is false, stop
        if (hook.config.blocking && result.success === false && result.shouldContinue === false) {
          break;
        }
      } catch (error) {
        const result: HookResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };

        this.executionLog.push({
          hookId: hook.id,
          event,
          result,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });

        results.push(result);

        if (hook.config.blocking && result.shouldContinue === false) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<HookResult> {
    const timeout = new Promise<HookResult>((_, reject) =>
      setTimeout(() => reject(new Error("Hook timeout")), timeoutMs)
    );

    try {
      const result = await Promise.race([promise, timeout]);
      return result as HookResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a shell command hook
   */
  private async executeCommand(
    command: string,
    context: HookContext
  ): Promise<HookResult> {
    // In production, this would use child_process.exec
    // For now, return a mock result
    return {
      success: true,
      output: `Command executed: ${command}`,
    };
  }

  /**
   * Get hooks for an event
   */
  getHooks(event: HookEvent): HookRegistration[] {
    return this.hooks.get(event) ?? [];
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): HookRegistration[] {
    const all: HookRegistration[] = [];
    for (const hooks of this.hooks.values()) {
      all.push(...hooks);
    }
    return all;
  }

  /**
   * Get execution log
   */
  getExecutionLog(options?: {
    event?: HookEvent;
    hookId?: string;
    limit?: number;
  }): typeof this.executionLog {
    let filtered = this.executionLog;

    if (options?.event) {
      filtered = filtered.filter((e) => e.event === options.event);
    }

    if (options?.hookId) {
      filtered = filtered.filter((e) => e.hookId === options.hookId);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get hook statistics
   */
  getStats(): {
    totalHooks: number;
    totalExecutions: number;
    successRate: number;
    averageDurationMs: number;
    byEvent: Record<string, { count: number; successRate: number }>;
  } {
    const totalExecutions = this.executionLog.length;
    const successful = this.executionLog.filter((e) => e.result.success).length;
    const successRate = totalExecutions > 0 ? successful / totalExecutions : 0;
    const avgDuration =
      totalExecutions > 0
        ? this.executionLog.reduce((sum, e) => sum + e.durationMs, 0) / totalExecutions
        : 0;

    const byEvent: Record<string, { count: number; successRate: number }> = {};
    for (const entry of this.executionLog) {
      if (!byEvent[entry.event]) {
        byEvent[entry.event] = { count: 0, successRate: 0 };
      }
      byEvent[entry.event].count++;
    }

    for (const [event, stats] of Object.entries(byEvent)) {
      const eventEntries = this.executionLog.filter((e) => e.event === event);
      const eventSuccessful = eventEntries.filter((e) => e.result.success).length;
      stats.successRate = stats.count > 0 ? eventSuccessful / stats.count : 0;
    }

    return {
      totalHooks: this.getAllHooks().length,
      totalExecutions,
      successRate,
      averageDurationMs: Math.round(avgDuration),
      byEvent,
    };
  }

  /**
   * Clear execution log
   */
  clearLog(): void {
    this.executionLog = [];
  }

  /**
   * Reset all hooks
   */
  reset(): void {
    this.hooks.clear();
    this.executionLog = [];
  }
}

// ============================================================================
// Pre-built Hook Handlers
// ============================================================================

/**
 * Create a PreToolUse hook that validates tool input
 */
export function createInputValidator(
  validator: (input: Record<string, unknown>) => boolean | string
): HookConfig {
  return {
    event: "PreToolUse",
    type: "function",
    blocking: true,
    handler: async (context) => {
      const result = validator(context.toolInput ?? {});
      if (result === true) {
        return { success: true, shouldContinue: true };
      }
      return {
        success: false,
        error: typeof result === "string" ? result : "Input validation failed",
        shouldContinue: false,
      };
    },
  };
}

/**
 * Create a PostToolUse hook that logs tool results
 */
export function createToolLogger(): HookConfig {
  return {
    event: "PostToolUse",
    type: "function",
    blocking: false,
    handler: async (context) => {
      console.log(`🔧 ${context.toolName} completed in ${context.metadata?.durationMs}ms`);
      return { success: true };
    },
  };
}

/**
 * Create a SessionStart hook that loads configuration
 */
export function createSessionInitializer(
  initFn: () => Promise<void>
): HookConfig {
  return {
    event: "SessionStart",
    type: "function",
    blocking: true,
    handler: async () => {
      await initFn();
      return { success: true };
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export const Hooks = {
  HookSystem,
  createInputValidator,
  createToolLogger,
  createSessionInitializer,
} as const;