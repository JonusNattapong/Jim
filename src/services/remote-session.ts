/**
 * Remote Session System
 * 
 * Inspired by Claude Code's remote session management that enables
 * WebSocket-based communication with remote Claude Code Runtime (CCR).
 * 
 * @see https://github.com/anthropic/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Remote session configuration
 */
export interface RemoteSessionConfig {
  /** CCR API endpoint */
  apiEndpoint: string;
  /** WebSocket endpoint */
  wsEndpoint: string;
  /** Authentication token */
  authToken: string;
  /** Session ID */
  sessionId: string;
  /** Auto-reconnect settings */
  autoReconnect: boolean;
  /** Max reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnect delay in ms */
  reconnectDelayMs: number;
}

/**
 * Remote session state
 */
export interface RemoteSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  latencyMs?: number;
}

/**
 * WebSocket message types
 */
export type WSMessageType =
  | "subscribe"
  | "message"
  | "permission_request"
  | "permission_response"
  | "ping"
  | "pong"
  | "error";

/**
 * WebSocket message
 */
export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

/**
 * Remote session events
 */
export type RemoteSessionEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason?: string }
  | { type: "message"; message: unknown }
  | { type: "permission_request"; request: unknown }
  | { type: "error"; error: Error }
  | { type: "reconnecting"; attempt: number }
  | { type: "reconnected" };

/**
 * Event handler
 */
export type RemoteSessionEventHandler = (event: RemoteSessionEvent) => void;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Partial<RemoteSessionConfig> = {
  apiEndpoint: "https://api.anthropic.com",
  wsEndpoint: "wss://api.anthropic.com",
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelayMs: 1000,
};

// ============================================================================
// Remote Session Manager
// ============================================================================

/**
 * Manages remote sessions via WebSocket
 */
export class RemoteSessionManager {
  private config: RemoteSessionConfig;
  private state: RemoteSessionState;
  private eventHandlers: RemoteSessionEventHandler[] = [];
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<RemoteSessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as RemoteSessionConfig;
    this.state = {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: RemoteSessionEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(handler: RemoteSessionEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index >= 0) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: RemoteSessionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Handler error, continue
      }
    }
  }

  /**
   * Connect to remote session
   */
  async connect(): Promise<boolean> {
    if (this.state.isConnected || this.state.isConnecting) {
      return this.state.isConnected;
    }

    this.state.isConnecting = true;

    try {
      // In production, this would establish WebSocket connection
      // For now, simulate connection
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.reconnectAttempts = 0;

      this.emit({ type: "connected" });

      // Start ping/pong keepalive
      this.startPing();

      return true;
    } catch (error) {
      this.state.isConnecting = false;
      this.state.lastError = error instanceof Error ? error.message : String(error);

      this.emit({
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });

      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }

      return false;
    }
  }

  /**
   * Disconnect from remote session
   */
  async disconnect(reason?: string): Promise<void> {
    this.stopPing();
    this.clearReconnectTimer();

    this.state.isConnected = false;
    this.state.isConnecting = false;

    this.emit({ type: "disconnected", reason });
  }

  /**
   * Send message to remote session
   */
  async sendMessage(message: unknown): Promise<boolean> {
    if (!this.state.isConnected) {
      return false;
    }

    try {
      // In production, this would send via WebSocket
      const wsMessage: WSMessage = {
        type: "message",
        payload: message,
        timestamp: Date.now(),
      };

      // Simulate send
      return true;
    } catch (error) {
      this.emit({
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Send permission response
   */
  async sendPermissionResponse(
    requestId: string,
    approved: boolean
  ): Promise<boolean> {
    return this.sendMessage({
      type: "permission_response",
      requestId,
      approved,
    });
  }

  /**
   * Start ping/pong keepalive
   */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.state.isConnected) {
        this.sendMessage({ type: "ping" });
      }
    }, 30_000);
  }

  /**
   * Stop ping/pong keepalive
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 5)) {
      return;
    }

    const delay =
      (this.config.reconnectDelayMs ?? 1000) *
      Math.pow(2, this.state.reconnectAttempts);

    this.emit({
      type: "reconnecting",
      attempt: this.state.reconnectAttempts + 1,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.state.reconnectAttempts++;
      const connected = await this.connect();
      if (connected) {
        this.emit({ type: "reconnected" });
      }
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Get current state
   */
  getState(): RemoteSessionState {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  getConfig(): RemoteSessionConfig {
    return { ...this.config };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Update latency measurement
   */
  updateLatency(latencyMs: number): void {
    this.state.latencyMs = latencyMs;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format remote session state for display
 */
export function formatRemoteSessionState(state: RemoteSessionState): string {
  const status = state.isConnected ? "🟢 Connected" : state.isConnecting ? "🟡 Connecting" : "🔴 Disconnected";
  const lines = [
    `📡 Remote Session: ${status}`,
    `   Reconnect attempts: ${state.reconnectAttempts}`,
  ];
  if (state.latencyMs !== undefined) {
    lines.push(`   Latency: ${state.latencyMs}ms`);
  }
  if (state.lastError) {
    lines.push(`   Last error: ${state.lastError}`);
  }
  return lines.join("\n");
}

// ============================================================================
// Exports
// ============================================================================

export const RemoteSession = {
  RemoteSessionManager,
  formatRemoteSessionState,
} as const;