/**
 * Bridge System for Jim
 * Provides remote control via WebSocket (mobile/web access)
 * Similar to Claude Code's Bridge system
 */

import { EventEmitter } from "events";
import { createServer, type Server, type IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import path from "path";

export interface BridgeConfig {
  port: number;
  host: string;
  authToken?: string;
  projectRoot: string;
}

export interface BridgeSession {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  clientId: string;
}

export interface BridgeMessage {
  type: string;
  payload: unknown;
  sessionId?: string;
  requestId?: string;
}

export interface BridgeResponse {
  type: string;
  payload: unknown;
  requestId?: string;
  error?: string;
}

export class BridgeServer extends EventEmitter {
  private httpServer: Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private sessions = new Map<string, BridgeSession>();
  private config: BridgeConfig;
  private agent: any = null;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
  }

  setAgent(agent: any): void {
    this.agent = agent;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = createServer((req, res) => {
          this.handleHttpRequest(req, res);
        });

        // Create WebSocket server
        this.wsServer = new WebSocketServer({ server: this.httpServer });

        this.wsServer.on("connection", (ws, req) => {
          this.handleConnection(ws, req);
        });

        this.httpServer.listen(this.config.port, this.config.host, () => {
          this.emit("listening", {
            port: this.config.port,
            host: this.config.host,
          });
          resolve();
        });

        this.httpServer.on("error", (err) => {
          this.emit("error", err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: any): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          sessions: this.sessions.size,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    // Session info endpoint
    if (url.pathname === "/api/sessions") {
      const sessionList = Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        clientId: s.clientId,
        connectedAt: s.connectedAt.toISOString(),
        lastActivity: s.lastActivity.toISOString(),
        userAgent: s.userAgent,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(sessionList));
      return;
    }

    // Tool execution endpoint (REST API)
    if (url.pathname === "/api/tool" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        try {
          const { tool, args } = JSON.parse(body);
          if (!this.agent) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Agent not available" }));
            return;
          }
          const result = await this.agent.runTool(tool, args);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: msg }));
        }
      });
      return;
    }

    // Default: 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Auth check
    if (this.config.authToken) {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const token =
        url.searchParams.get("token") ??
        req.headers.authorization?.replace("Bearer ", "");
      if (token !== this.config.authToken) {
        ws.close(4001, "Unauthorized");
        return;
      }
    }

    const sessionId = this.generateId();
    const clientId =
      (req.headers["x-client-id"] as string) ?? this.generateId();
    const userAgent = req.headers["user-agent"];

    const session: BridgeSession = {
      id: sessionId,
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
      userAgent,
      clientId,
    };

    this.sessions.set(sessionId, session);
    this.emit("connected", { sessionId, clientId });

    // Send welcome message
    this.sendToClient(ws, {
      type: "welcome",
      payload: {
        sessionId,
        serverVersion: "1.0.0",
        projectRoot: this.config.projectRoot,
      },
    });

    // Handle messages
    ws.on("message", (data: Buffer) => {
      try {
        const message: BridgeMessage = JSON.parse(data.toString());
        this.handleMessage(session, message);
      } catch (err) {
        this.sendToClient(ws, {
          type: "error",
          payload: { message: "Invalid JSON message" },
        });
      }
    });

    ws.on("close", () => {
      this.sessions.delete(sessionId);
      this.emit("disconnected", { sessionId });
    });

    ws.on("error", (err) => {
      this.emit("sessionError", { sessionId, error: err });
      this.sessions.delete(sessionId);
    });
  }

  private async handleMessage(
    session: BridgeSession,
    message: BridgeMessage,
  ): Promise<void> {
    session.lastActivity = new Date();

    switch (message.type) {
      case "ping":
        this.sendToClient(session.ws, {
          type: "pong",
          payload: { timestamp: Date.now() },
        });
        break;

      case "tool_execute": {
        const { tool, args } = message.payload as {
          tool: string;
          args: Record<string, unknown>;
        };
        if (!this.agent) {
          this.sendToClient(session.ws, {
            type: "error",
            payload: { message: "Agent not available" },
            requestId: message.requestId,
          });
          return;
        }
        try {
          const result = await this.agent.runTool(tool, args);
          this.sendToClient(session.ws, {
            type: "tool_result",
            payload: result,
            requestId: message.requestId,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.sendToClient(session.ws, {
            type: "error",
            payload: { message: msg },
            requestId: message.requestId,
          });
        }
        break;
      }

      case "agent_send": {
        const { prompt } = message.payload as { prompt: string };
        if (!this.agent) {
          this.sendToClient(session.ws, {
            type: "error",
            payload: { message: "Agent not available" },
            requestId: message.requestId,
          });
          return;
        }
        try {
          const response = await this.agent.run(prompt);
          this.sendToClient(session.ws, {
            type: "agent_response",
            payload: { response },
            requestId: message.requestId,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.sendToClient(session.ws, {
            type: "error",
            payload: { message: msg },
            requestId: message.requestId,
          });
        }
        break;
      }

      case "session_status":
        this.sendToClient(session.ws, {
          type: "session_status",
          payload: {
            sessionId: session.id,
            clientId: session.clientId,
            connectedAt: session.connectedAt.toISOString(),
            lastActivity: session.lastActivity.toISOString(),
          },
          requestId: message.requestId,
        });
        break;

      case "list_sessions":
        this.sendToClient(session.ws, {
          type: "sessions_list",
          payload: Array.from(this.sessions.values()).map((s) => ({
            id: s.id,
            clientId: s.clientId,
            connectedAt: s.connectedAt.toISOString(),
          })),
          requestId: message.requestId,
        });
        break;

      default:
        this.sendToClient(session.ws, {
          type: "error",
          payload: { message: `Unknown message type: ${message.type}` },
          requestId: message.requestId,
        });
    }
  }

  private sendToClient(ws: WebSocket, response: BridgeResponse): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload });
    for (const session of this.sessions.values()) {
      if (session.ws.readyState === session.ws.OPEN) {
        session.ws.send(message);
      }
    }
  }

  getSessions(): BridgeSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  async stop(): Promise<void> {
    // Close all WebSocket connections
    for (const session of this.sessions.values()) {
      session.ws.close(1000, "Server shutting down");
    }
    this.sessions.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

/**
 * Bridge Client for connecting to a remote Jim instance
 */
export class BridgeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connected = false;

  constructor(
    private serverUrl: string,
    private authToken?: string,
    private clientId?: string,
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.serverUrl);
        if (this.authToken) {
          url.searchParams.set("token", this.authToken);
        }

        // Dynamic import for ws
        const WS = require("ws");
        this.ws = new WS(url.toString(), {
          headers: this.clientId ? { "X-Client-Id": this.clientId } : {},
        });

        this.ws.on("open", () => {
          this.connected = true;
          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch {
            // Ignore parse errors
          }
        });

        this.ws.on("close", () => {
          this.connected = false;
          this.emit("disconnected");
          this.scheduleReconnect();
        });

        this.ws.on("error", (err: Error) => {
          this.emit("error", err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(message: any): void {
    if (message.requestId) {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        this.pendingRequests.delete(message.requestId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.payload);
        }
      }
    }

    this.emit("message", message);
  }

  async send(type: string, payload: unknown): Promise<unknown> {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected");
    }

    const requestId = String(++this.requestId);
    const message = { type, payload, requestId };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.ws!.send(JSON.stringify(message));
    });
  }

  async executeTool(
    tool: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.send("tool_execute", { tool, args });
  }

  async sendPrompt(prompt: string): Promise<unknown> {
    return this.send("agent_send", { prompt });
  }

  async ping(): Promise<number> {
    const start = Date.now();
    await this.send("ping", {});
    return Date.now() - start;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, 5000);
  }
}
