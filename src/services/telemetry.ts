/**
 * Telemetry System for Jim
 * Full telemetry with session tracking, token usage, cost tracking, and analytics
 */

import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  sessionId?: string;
}

export interface SessionStats {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalTokens: number;
  totalCost: number;
  toolCalls: number;
  errors: number;
  turns: number;
}

export interface TelemetrySnapshot {
  sessions: number;
  totalEvents: number;
  totalTokens: number;
  totalCost: number;
  toolCalls: number;
  errors: number;
  uptime: number;
}

export class TelemetryManager extends EventEmitter {
  private events: TelemetryEvent[] = [];
  private sessions: Map<string, SessionStats> = new Map();
  private currentSessionId: string;
  private startTime: number;
  private enabled = true;
  private storageDir: string;
  private maxEvents = 10000;

  constructor(storageDir: string) {
    super();
    this.storageDir = storageDir;
    this.currentSessionId = this.generateId();
    this.startTime = Date.now();
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await this.loadPersisted();
    } catch {
      // Storage dir creation failed
    }
  }

  startSession(sessionId?: string): void {
    this.currentSessionId = sessionId ?? this.generateId();
    this.sessions.set(this.currentSessionId, {
      sessionId: this.currentSessionId,
      startTime: Date.now(),
      totalTokens: 0,
      totalCost: 0,
      toolCalls: 0,
      errors: 0,
      turns: 0,
    });
    this.track("session_start", { sessionId: this.currentSessionId });
  }

  endSession(sessionId?: string): void {
    const id = sessionId ?? this.currentSessionId;
    const session = this.sessions.get(id);
    if (session) {
      session.endTime = Date.now();
      this.track("session_end", {
        sessionId: id,
        duration: session.endTime - session.startTime,
      });
    }
  }

  track(type: string, data: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      data,
      sessionId: this.currentSessionId,
    };

    this.events.push(event);

    // Trim events if too many
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.emit("event", event);
  }

  trackToolCall(toolName: string, success: boolean, durationMs: number): void {
    this.track("tool_call", { toolName, success, durationMs });
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.toolCalls++;
      if (!success) session.errors++;
    }
  }

  trackTokenUsage(tokens: number, cost: number): void {
    this.track("token_usage", { tokens, cost });
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.totalTokens += tokens;
      session.totalCost += cost;
    }
  }

  trackTurn(): void {
    this.track("turn");
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.turns++;
    }
  }

  trackError(error: string, context?: string): void {
    this.track("error", { error, context });
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.errors++;
    }
  }

  getSnapshot(): TelemetrySnapshot {
    let totalTokens = 0;
    let totalCost = 0;
    let toolCalls = 0;
    let errors = 0;

    for (const session of this.sessions.values()) {
      totalTokens += session.totalTokens;
      totalCost += session.totalCost;
      toolCalls += session.toolCalls;
      errors += session.errors;
    }

    return {
      sessions: this.sessions.size,
      totalEvents: this.events.length,
      totalTokens,
      totalCost,
      toolCalls,
      errors,
      uptime: Date.now() - this.startTime,
    };
  }

  getSessionStats(sessionId?: string): SessionStats | undefined {
    return this.sessions.get(sessionId ?? this.currentSessionId);
  }

  getEvents(type?: string, limit = 100): TelemetryEvent[] {
    let filtered = type
      ? this.events.filter((e) => e.type === type)
      : this.events;
    return filtered.slice(-limit);
  }

  formatReport(): string {
    const snap = this.getSnapshot();
    const current = this.sessions.get(this.currentSessionId);

    return [
      "📊 **Telemetry Report**",
      "",
      `Sessions: ${snap.sessions}`,
      `Events: ${snap.totalEvents}`,
      `Uptime: ${this.formatDuration(snap.uptime)}`,
      "",
      `Total Tokens: ${snap.totalTokens.toLocaleString()}`,
      `Total Cost: $${snap.totalCost.toFixed(4)}`,
      `Tool Calls: ${snap.toolCalls}`,
      `Errors: ${snap.errors}`,
      "",
      current
        ? `Current Session: ${current.turns} turns, ${current.toolCalls} tool calls`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async loadPersisted(): Promise<void> {
    try {
      const dataPath = path.join(this.storageDir, "telemetry.json");
      const data = await fs.readFile(dataPath, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.sessions) {
        for (const session of parsed.sessions) {
          this.sessions.set(session.sessionId, session);
        }
      }
    } catch {
      // No persisted data
    }
  }

  async persist(): Promise<void> {
    try {
      const dataPath = path.join(this.storageDir, "telemetry.json");
      const data = {
        sessions: Array.from(this.sessions.values()),
        lastUpdated: Date.now(),
      };
      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch {
      // Persist failed
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clear(): void {
    this.events = [];
    this.sessions.clear();
    this.startSession();
  }
}
