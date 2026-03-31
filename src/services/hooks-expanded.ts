/**
 * Expanded Hooks System for Jim
 * 50+ hooks covering UI, Session, Plugin, Voice, Notifications, etc.
 */

import { EventEmitter } from "events";

export interface Hook {
  event: string;
  handler: (data: unknown) => void | Promise<void>;
  description: string;
  category: string;
}

export class HooksExpanded extends EventEmitter {
  private hooks: Map<string, Hook[]> = new Map();

  constructor() {
    super();
    this.registerDefaultHooks();
  }

  private registerDefaultHooks(): void {
    const hooks: Hook[] = [
      // Session hooks (10)
      {
        event: "PreSession",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session starting: ${d.sessionId ?? "unknown"}`);
        },
        description: "Before session starts",
        category: "session",
      },
      {
        event: "PostSession",
        handler: (data) => {
          const d = data as { sessionId?: string; duration?: number };
          console.log(
            `[Hook] Session ended: ${d.sessionId ?? "unknown"} (${d.duration ?? 0}ms)`,
          );
        },
        description: "After session ends",
        category: "session",
      },
      {
        event: "SessionRestore",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session restored: ${d.sessionId ?? "unknown"}`);
        },
        description: "When restoring a session",
        category: "session",
      },
      {
        event: "SessionSave",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session saved: ${d.sessionId ?? "unknown"}`);
        },
        description: "When saving a session",
        category: "session",
      },
      {
        event: "SessionClear",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session cleared: ${d.sessionId ?? "unknown"}`);
        },
        description: "When clearing a session",
        category: "session",
      },
      {
        event: "OnCheckpoint",
        handler: (data) => {
          const d = data as { label?: string };
          console.log(`[Hook] Checkpoint created: ${d.label ?? "auto"}`);
        },
        description: "When creating a checkpoint",
        category: "session",
      },
      {
        event: "OnRestore",
        handler: (data) => {
          const d = data as { checkpointId?: string };
          console.log(
            `[Hook] Restored from checkpoint: ${d.checkpointId ?? "unknown"}`,
          );
        },
        description: "When restoring from checkpoint",
        category: "session",
      },
      {
        event: "OnSessionExpire",
        handler: (data) => {
          const d = data as { sessionId?: string; reason?: string };
          console.log(
            `[Hook] Session expired: ${d.sessionId ?? "unknown"} (${d.reason ?? "timeout"})`,
          );
        },
        description: "When session expires",
        category: "session",
      },
      {
        event: "OnSessionPause",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session paused: ${d.sessionId ?? "unknown"}`);
        },
        description: "When pausing a session",
        category: "session",
      },
      {
        event: "OnSessionResume",
        handler: (data) => {
          const d = data as { sessionId?: string };
          console.log(`[Hook] Session resumed: ${d.sessionId ?? "unknown"}`);
        },
        description: "When resuming a session",
        category: "session",
      },

      // Tool hooks (10)
      {
        event: "PreToolUse",
        handler: (data) => {
          const d = data as { tool?: string };
          console.log(`[Hook] Tool executing: ${d.tool ?? "unknown"}`);
        },
        description: "Before tool execution",
        category: "tool",
      },
      {
        event: "PostToolUse",
        handler: (data) => {
          const d = data as {
            tool?: string;
            duration?: number;
            success?: boolean;
          };
          const status = d.success ? "✅" : "❌";
          console.log(
            `[Hook] ${status} Tool completed: ${d.tool ?? "unknown"} (${d.duration ?? 0}ms)`,
          );
        },
        description: "After tool execution",
        category: "tool",
      },
      {
        event: "ToolError",
        handler: (data) => {
          const d = data as { tool?: string; error?: string };
          console.error(
            `[Hook] Tool error: ${d.tool ?? "unknown"} - ${d.error ?? "unknown error"}`,
          );
        },
        description: "When tool fails",
        category: "tool",
      },
      {
        event: "ToolRetry",
        handler: (data) => {
          const d = data as { tool?: string; attempt?: number };
          console.warn(
            `[Hook] Tool retry: ${d.tool ?? "unknown"} (attempt ${d.attempt ?? 1})`,
          );
        },
        description: "When tool retries",
        category: "tool",
      },
      {
        event: "ToolTimeout",
        handler: (data) => {
          const d = data as { tool?: string; timeout?: number };
          console.warn(
            `[Hook] Tool timeout: ${d.tool ?? "unknown"} (${d.timeout ?? 0}ms)`,
          );
        },
        description: "When tool times out",
        category: "tool",
      },
      {
        event: "ToolPermissionDenied",
        handler: (data) => {
          const d = data as { tool?: string; reason?: string };
          console.warn(
            `[Hook] Permission denied: ${d.tool ?? "unknown"} - ${d.reason ?? "not allowed"}`,
          );
        },
        description: "When tool permission denied",
        category: "tool",
      },
      {
        event: "ToolAnalytics",
        handler: (data) => {
          const d = data as { tool?: string; calls?: number; errors?: number };
          console.log(
            `[Hook] Tool analytics: ${d.tool ?? "unknown"} (${d.calls ?? 0} calls, ${d.errors ?? 0} errors)`,
          );
        },
        description: "Tool analytics update",
        category: "tool",
      },
      {
        event: "ToolRegistryChange",
        handler: (data) => {
          const d = data as { action?: string; tool?: string };
          console.log(
            `[Hook] Registry change: ${d.action ?? "unknown"} - ${d.tool ?? "unknown"}`,
          );
        },
        description: "When tool registry changes",
        category: "tool",
      },
      {
        event: "ToolBatchStart",
        handler: (data) => {
          const d = data as { count?: number };
          console.log(`[Hook] Tool batch started: ${d.count ?? 0} tools`);
        },
        description: "Start of tool batch",
        category: "tool",
      },
      {
        event: "ToolBatchEnd",
        handler: (data) => {
          const d = data as { count?: number; duration?: number };
          console.log(
            `[Hook] Tool batch ended: ${d.count ?? 0} tools (${d.duration ?? 0}ms)`,
          );
        },
        description: "End of tool batch",
        category: "tool",
      },

      // Context hooks (8)
      {
        event: "PreCompaction",
        handler: (data) => {
          const d = data as { tokens?: number };
          console.log(`[Hook] Compacting context: ~${d.tokens ?? 0} tokens`);
        },
        description: "Before context compaction",
        category: "context",
      },
      {
        event: "PostCompaction",
        handler: (data) => {
          const d = data as { before?: number; after?: number; ratio?: number };
          console.log(
            `[Hook] Context compacted: ${d.before ?? 0} → ${d.after ?? 0} tokens (${((d.ratio ?? 1) * 100).toFixed(1)}%)`,
          );
        },
        description: "After context compaction",
        category: "context",
      },
      {
        event: "ContextOverflow",
        handler: (data) => {
          const d = data as { tokens?: number; limit?: number };
          console.warn(
            `[Hook] Context overflow: ${d.tokens ?? 0} tokens exceeds ${d.limit ?? 0} limit`,
          );
        },
        description: "When context overflows",
        category: "context",
      },
      {
        event: "MemoryLearn",
        handler: (data) => {
          const d = data as { fact?: string; category?: string };
          console.log(
            `[Hook] Learned: "${(d.fact ?? "").slice(0, 50)}" (${d.category ?? "general"})`,
          );
        },
        description: "When learning new fact",
        category: "context",
      },
      {
        event: "MemoryRecall",
        handler: (data) => {
          const d = data as { query?: string; results?: number };
          console.log(
            `[Hook] Memory recall: "${d.query ?? ""}" (${d.results ?? 0} results)`,
          );
        },
        description: "When recalling memory",
        category: "context",
      },
      {
        event: "ContextPin",
        handler: (data) => {
          const d = data as { id?: string; type?: string };
          console.log(
            `[Hook] Context pinned: ${d.id ?? "unknown"} (${d.type ?? "unknown"})`,
          );
        },
        description: "When pinning context",
        category: "context",
      },
      {
        event: "ContextUnpin",
        handler: (data) => {
          const d = data as { id?: string };
          console.log(`[Hook] Context unpinned: ${d.id ?? "unknown"}`);
        },
        description: "When unpinning context",
        category: "context",
      },
      {
        event: "TokenBudgetWarning",
        handler: (data) => {
          const d = data as {
            used?: number;
            budget?: number;
            percent?: number;
          };
          console.warn(
            `[Hook] Token budget warning: ${d.used ?? 0}/${d.budget ?? 0} (${d.percent ?? 0}%)`,
          );
        },
        description: "Token budget warning",
        category: "context",
      },

      // Agent hooks (8)
      {
        event: "AgentStart",
        handler: (data) => {
          const d = data as { agentId?: string; task?: string };
          console.log(
            `[Hook] Agent started: ${d.agentId ?? "main"} - ${d.task ?? ""}`,
          );
        },
        description: "Agent starts",
        category: "agent",
      },
      {
        event: "AgentEnd",
        handler: (data) => {
          const d = data as {
            agentId?: string;
            duration?: number;
            success?: boolean;
          };
          const status = d.success ? "✅" : "❌";
          console.log(
            `[Hook] ${status} Agent ended: ${d.agentId ?? "main"} (${d.duration ?? 0}ms)`,
          );
        },
        description: "Agent ends",
        category: "agent",
      },
      {
        event: "AgentError",
        handler: (data) => {
          const d = data as { agentId?: string; error?: string };
          console.error(
            `[Hook] Agent error: ${d.agentId ?? "main"} - ${d.error ?? "unknown"}`,
          );
        },
        description: "Agent error",
        category: "agent",
      },
      {
        event: "SubAgentSpawn",
        handler: (data) => {
          const d = data as {
            parentId?: string;
            childId?: string;
            task?: string;
          };
          console.log(
            `[Hook] Sub-agent spawned: ${d.childId ?? "unknown"} from ${d.parentId ?? "main"} - ${d.task ?? ""}`,
          );
        },
        description: "Sub-agent spawned",
        category: "agent",
      },
      {
        event: "SubAgentComplete",
        handler: (data) => {
          const d = data as { childId?: string; duration?: number };
          console.log(
            `[Hook] Sub-agent complete: ${d.childId ?? "unknown"} (${d.duration ?? 0}ms)`,
          );
        },
        description: "Sub-agent complete",
        category: "agent",
      },
      {
        event: "AgentTurn",
        handler: (data) => {
          const d = data as { turn?: number; tokens?: number };
          console.log(
            `[Hook] Agent turn ${d.turn ?? 0}: ~${d.tokens ?? 0} tokens`,
          );
        },
        description: "Agent turn",
        category: "agent",
      },
      {
        event: "AgentRetry",
        handler: (data) => {
          const d = data as { attempt?: number; reason?: string };
          console.warn(
            `[Hook] Agent retry: attempt ${d.attempt ?? 1} - ${d.reason ?? "unknown"}`,
          );
        },
        description: "Agent retry",
        category: "agent",
      },
      {
        event: "AgentTimeout",
        handler: (data) => {
          const d = data as { agentId?: string; timeout?: number };
          console.warn(
            `[Hook] Agent timeout: ${d.agentId ?? "main"} (${d.timeout ?? 0}ms)`,
          );
        },
        description: "Agent timeout",
        category: "agent",
      },

      // MCP hooks (8)
      {
        event: "McpConnect",
        handler: (data) => {
          const d = data as { server?: string; tools?: number };
          console.log(
            `[Hook] MCP connected: ${d.server ?? "unknown"} (${d.tools ?? 0} tools)`,
          );
        },
        description: "MCP server connects",
        category: "mcp",
      },
      {
        event: "McpDisconnect",
        handler: (data) => {
          const d = data as { server?: string; reason?: string };
          console.log(
            `[Hook] MCP disconnected: ${d.server ?? "unknown"} (${d.reason ?? "unknown"})`,
          );
        },
        description: "MCP server disconnects",
        category: "mcp",
      },
      {
        event: "McpError",
        handler: (data) => {
          const d = data as { server?: string; error?: string };
          console.error(
            `[Hook] MCP error: ${d.server ?? "unknown"} - ${d.error ?? "unknown"}`,
          );
        },
        description: "MCP error",
        category: "mcp",
      },
      {
        event: "McpToolChange",
        handler: (data) => {
          const d = data as {
            server?: string;
            added?: number;
            removed?: number;
          };
          console.log(
            `[Hook] MCP tools changed: ${d.server ?? "unknown"} (+${d.added ?? 0}/-${d.removed ?? 0})`,
          );
        },
        description: "MCP tools change",
        category: "mcp",
      },
      {
        event: "McpReconnect",
        handler: (data) => {
          const d = data as { server?: string; attempt?: number };
          console.log(
            `[Hook] MCP reconnecting: ${d.server ?? "unknown"} (attempt ${d.attempt ?? 1})`,
          );
        },
        description: "MCP reconnect",
        category: "mcp",
      },
      {
        event: "McpAuthRequired",
        handler: (data) => {
          const d = data as { server?: string; type?: string };
          console.log(
            `[Hook] MCP auth required: ${d.server ?? "unknown"} (${d.type ?? "unknown"})`,
          );
        },
        description: "MCP auth required",
        category: "mcp",
      },
      {
        event: "McpResourceUpdate",
        handler: (data) => {
          const d = data as { server?: string; resource?: string };
          console.log(
            `[Hook] MCP resource updated: ${d.server ?? "unknown"} - ${d.resource ?? "unknown"}`,
          );
        },
        description: "MCP resource update",
        category: "mcp",
      },
      {
        event: "McpRateLimit",
        handler: (data) => {
          const d = data as { server?: string; retryAfter?: number };
          console.warn(
            `[Hook] MCP rate limited: ${d.server ?? "unknown"} (retry after ${d.retryAfter ?? 0}ms)`,
          );
        },
        description: "MCP rate limit",
        category: "mcp",
      },

      // UI hooks (8)
      {
        event: "RenderStart",
        handler: () => {
          // Minimal logging for render events
        },
        description: "UI render start",
        category: "ui",
      },
      {
        event: "RenderEnd",
        handler: () => {
          // Minimal logging for render events
        },
        description: "UI render end",
        category: "ui",
      },
      {
        event: "ThemeChange",
        handler: (data) => {
          const d = data as { theme?: string };
          console.log(`[Hook] Theme changed: ${d.theme ?? "unknown"}`);
        },
        description: "Theme change",
        category: "ui",
      },
      {
        event: "ColorChange",
        handler: (data) => {
          const d = data as { color?: string };
          console.log(`[Hook] Color changed: ${d.color ?? "unknown"}`);
        },
        description: "Color change",
        category: "ui",
      },
      {
        event: "StatusUpdate",
        handler: (data) => {
          // Minimal logging for status updates
        },
        description: "Status update",
        category: "ui",
      },
      {
        event: "ProgressUpdate",
        handler: (data) => {
          // Minimal logging for progress updates
        },
        description: "Progress update",
        category: "ui",
      },
      {
        event: "NotificationShow",
        handler: (data) => {
          const d = data as { type?: string; message?: string };
          console.log(
            `[Hook] Notification: [${d.type ?? "info"}] ${d.message ?? ""}`,
          );
        },
        description: "Notification show",
        category: "ui",
      },
      {
        event: "NotificationDismiss",
        handler: () => {
          // Minimal logging for dismiss
        },
        description: "Notification dismiss",
        category: "ui",
      },

      // Voice hooks (8)
      {
        event: "VoiceStart",
        handler: () => {
          console.log("[Hook] Voice recognition started");
        },
        description: "Voice recognition starts",
        category: "voice",
      },
      {
        event: "VoiceEnd",
        handler: (data) => {
          const d = data as { duration?: number };
          console.log(`[Hook] Voice recognition ended (${d.duration ?? 0}ms)`);
        },
        description: "Voice recognition ends",
        category: "voice",
      },
      {
        event: "VoiceResult",
        handler: (data) => {
          const d = data as { text?: string; confidence?: number };
          console.log(
            `[Hook] Voice result: "${(d.text ?? "").slice(0, 50)}" (${((d.confidence ?? 0) * 100).toFixed(0)}%)`,
          );
        },
        description: "Voice recognition result",
        category: "voice",
      },
      {
        event: "VoiceError",
        handler: (data) => {
          const d = data as { error?: string };
          console.error(`[Hook] Voice error: ${d.error ?? "unknown"}`);
        },
        description: "Voice recognition error",
        category: "voice",
      },
      {
        event: "TTSStart",
        handler: (data) => {
          const d = data as { text?: string; engine?: string };
          console.log(
            `[Hook] TTS started: "${(d.text ?? "").slice(0, 30)}..." (${d.engine ?? "native"})`,
          );
        },
        description: "Text-to-speech starts",
        category: "voice",
      },
      {
        event: "TTSEnd",
        handler: (data) => {
          const d = data as { duration?: number };
          console.log(`[Hook] TTS ended (${d.duration ?? 0}ms)`);
        },
        description: "Text-to-speech ends",
        category: "voice",
      },
      {
        event: "TTSError",
        handler: (data) => {
          const d = data as { error?: string; engine?: string };
          console.error(
            `[Hook] TTS error (${d.engine ?? "unknown"}): ${d.error ?? "unknown"}`,
          );
        },
        description: "Text-to-speech error",
        category: "voice",
      },
      {
        event: "VoiceCommand",
        handler: (data) => {
          const d = data as { command?: string; confidence?: number };
          console.log(
            `[Hook] Voice command: "${d.command ?? ""}" (${((d.confidence ?? 0) * 100).toFixed(0)}%)`,
          );
        },
        description: "Voice command received",
        category: "voice",
      },

      // Plugin hooks (8)
      {
        event: "PluginLoad",
        handler: (data) => {
          const d = data as { name?: string; tools?: number };
          console.log(
            `[Hook] Plugin loaded: ${d.name ?? "unknown"} (${d.tools ?? 0} tools)`,
          );
        },
        description: "Plugin loaded",
        category: "plugin",
      },
      {
        event: "PluginUnload",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Plugin unloaded: ${d.name ?? "unknown"}`);
        },
        description: "Plugin unloaded",
        category: "plugin",
      },
      {
        event: "PluginError",
        handler: (data) => {
          const d = data as { name?: string; error?: string };
          console.error(
            `[Hook] Plugin error: ${d.name ?? "unknown"} - ${d.error ?? "unknown"}`,
          );
        },
        description: "Plugin error",
        category: "plugin",
      },
      {
        event: "PluginReload",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Plugin reloaded: ${d.name ?? "unknown"}`);
        },
        description: "Plugin reloaded",
        category: "plugin",
      },
      {
        event: "PluginConfigChange",
        handler: (data) => {
          const d = data as { name?: string; key?: string };
          console.log(
            `[Hook] Plugin config changed: ${d.name ?? "unknown"} - ${d.key ?? "unknown"}`,
          );
        },
        description: "Plugin config change",
        category: "plugin",
      },
      {
        event: "PluginDependencyMissing",
        handler: (data) => {
          const d = data as { name?: string; dependency?: string };
          console.warn(
            `[Hook] Plugin dependency missing: ${d.name ?? "unknown"} needs ${d.dependency ?? "unknown"}`,
          );
        },
        description: "Plugin dependency missing",
        category: "plugin",
      },
      {
        event: "PluginActivation",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Plugin activated: ${d.name ?? "unknown"}`);
        },
        description: "Plugin activation",
        category: "plugin",
      },
      {
        event: "PluginDeactivation",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Plugin deactivated: ${d.name ?? "unknown"}`);
        },
        description: "Plugin deactivation",
        category: "plugin",
      },

      // Skill hooks (8)
      {
        event: "SkillLoad",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Skill loaded: ${d.name ?? "unknown"}`);
        },
        description: "Skill loaded",
        category: "skill",
      },
      {
        event: "SkillUnload",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Skill unloaded: ${d.name ?? "unknown"}`);
        },
        description: "Skill unloaded",
        category: "skill",
      },
      {
        event: "SkillExecute",
        handler: (data) => {
          const d = data as { name?: string; duration?: number };
          console.log(
            `[Hook] Skill executed: ${d.name ?? "unknown"} (${d.duration ?? 0}ms)`,
          );
        },
        description: "Skill executed",
        category: "skill",
      },
      {
        event: "SkillError",
        handler: (data) => {
          const d = data as { name?: string; error?: string };
          console.error(
            `[Hook] Skill error: ${d.name ?? "unknown"} - ${d.error ?? "unknown"}`,
          );
        },
        description: "Skill error",
        category: "skill",
      },
      {
        event: "SkillMatch",
        handler: (data) => {
          const d = data as { name?: string; confidence?: number };
          console.log(
            `[Hook] Skill matched: ${d.name ?? "unknown"} (${((d.confidence ?? 0) * 100).toFixed(0)}%)`,
          );
        },
        description: "Skill matched",
        category: "skill",
      },
      {
        event: "SkillLearn",
        handler: (data) => {
          const d = data as { name?: string; pattern?: string };
          console.log(
            `[Hook] Skill learned: ${d.name ?? "unknown"} - ${(d.pattern ?? "").slice(0, 30)}`,
          );
        },
        description: "Skill learned",
        category: "skill",
      },
      {
        event: "SkillForget",
        handler: (data) => {
          const d = data as { name?: string };
          console.log(`[Hook] Skill forgotten: ${d.name ?? "unknown"}`);
        },
        description: "Skill forgotten",
        category: "skill",
      },
      {
        event: "SkillUpdate",
        handler: (data) => {
          const d = data as { name?: string; version?: string };
          console.log(
            `[Hook] Skill updated: ${d.name ?? "unknown"} (v${d.version ?? "?"})`,
          );
        },
        description: "Skill updated",
        category: "skill",
      },

      // Permission hooks (6)
      {
        event: "PermissionRequest",
        handler: (data) => {
          const d = data as { tool?: string; reason?: string };
          console.log(
            `[Hook] Permission requested: ${d.tool ?? "unknown"} - ${d.reason ?? ""}`,
          );
        },
        description: "Permission requested",
        category: "permission",
      },
      {
        event: "PermissionGranted",
        handler: (data) => {
          const d = data as { tool?: string; mode?: string };
          console.log(
            `[Hook] Permission granted: ${d.tool ?? "unknown"} (${d.mode ?? "ask"})`,
          );
        },
        description: "Permission granted",
        category: "permission",
      },
      {
        event: "PermissionDenied",
        handler: (data) => {
          const d = data as { tool?: string; reason?: string };
          console.warn(
            `[Hook] Permission denied: ${d.tool ?? "unknown"} - ${d.reason ?? "not allowed"}`,
          );
        },
        description: "Permission denied",
        category: "permission",
      },
      {
        event: "PermissionChange",
        handler: (data) => {
          const d = data as { from?: string; to?: string };
          console.log(
            `[Hook] Permission mode: ${d.from ?? "unknown"} → ${d.to ?? "unknown"}`,
          );
        },
        description: "Permission mode change",
        category: "permission",
      },
      {
        event: "PermissionEscalation",
        handler: (data) => {
          const d = data as { tool?: string; from?: string; to?: string };
          console.warn(
            `[Hook] Permission escalation: ${d.tool ?? "unknown"} (${d.from ?? "unknown"} → ${d.to ?? "unknown"})`,
          );
        },
        description: "Permission escalation",
        category: "permission",
      },
      {
        event: "PermissionAudit",
        handler: (data) => {
          const d = data as { tool?: string; decision?: string };
          console.log(
            `[Hook] Permission audit: ${d.tool ?? "unknown"} - ${d.decision ?? "unknown"}`,
          );
        },
        description: "Permission audit",
        category: "permission",
      },

      // Budget hooks (4)
      {
        event: "BudgetCheck",
        handler: (data) => {
          const d = data as { used?: number; budget?: number };
          console.log(
            `[Hook] Budget check: $${(d.used ?? 0).toFixed(4)} / $${(d.budget ?? 0).toFixed(2)}`,
          );
        },
        description: "Budget check",
        category: "budget",
      },
      {
        event: "BudgetExceeded",
        handler: (data) => {
          const d = data as { used?: number; budget?: number };
          console.error(
            `[Hook] Budget exceeded: $${(d.used ?? 0).toFixed(4)} > $${(d.budget ?? 0).toFixed(2)}`,
          );
        },
        description: "Budget exceeded",
        category: "budget",
      },
      {
        event: "BudgetWarning",
        handler: (data) => {
          const d = data as {
            used?: number;
            budget?: number;
            percent?: number;
          };
          console.warn(
            `[Hook] Budget warning: $${(d.used ?? 0).toFixed(4)} / $${(d.budget ?? 0).toFixed(2)} (${d.percent ?? 0}%)`,
          );
        },
        description: "Budget warning",
        category: "budget",
      },
      {
        event: "BudgetReset",
        handler: (data) => {
          const d = data as { period?: string };
          console.log(`[Hook] Budget reset: ${d.period ?? "unknown"}`);
        },
        description: "Budget reset",
        category: "budget",
      },
    ];

    for (const hook of hooks) {
      this.register(hook);
    }
  }

  register(hook: Hook): void {
    const existing = this.hooks.get(hook.event) ?? [];
    existing.push(hook);
    this.hooks.set(hook.event, existing);
  }

  async fire(event: string, data?: unknown): Promise<void> {
    const hooks = this.hooks.get(event) ?? [];
    for (const hook of hooks) {
      try {
        await hook.handler(data);
      } catch (err) {
        this.emit("hookError", { event, error: err });
      }
    }
    this.emit(event, data);
  }

  list(): Hook[] {
    return Array.from(this.hooks.values()).flat();
  }

  listByCategory(category: string): Hook[] {
    return this.list().filter((h) => h.category === category);
  }

  getCategories(): string[] {
    return Array.from(new Set(this.list().map((h) => h.category)));
  }

  count(): number {
    return this.list().length;
  }

  countByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const hook of this.list()) {
      counts[hook.category] = (counts[hook.category] ?? 0) + 1;
    }
    return counts;
  }

  formatReport(): string {
    const byCategory = this.countByCategory();
    return [
      `🔗 **Hooks: ${this.count()} total**`,
      "",
      ...Object.entries(byCategory).map(([cat, count]) => `- ${cat}: ${count}`),
    ].join("\n");
  }
}
