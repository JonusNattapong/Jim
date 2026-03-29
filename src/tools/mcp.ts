import { spawn } from "node:child_process";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { childLogger } from "../utils/logger.js";

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  /** Max reconnect attempts (default: 3) */
  maxReconnects?: number;
  /** Reconnect delay in ms (default: 2000) */
  reconnectDelay?: number;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

/** Callback type for tool list changes */
export type OnToolsChanged = (serverName: string) => void;

/**
 * MCP Client — connects to MCP servers via stdio transport.
 * Supports reconnect and tools/list_changed notifications.
 */
export class MCPClient {
  private config: MCPServerConfig;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private childProcess?: ReturnType<typeof spawn>;
  private tools: MCPTool[] = [];
  private initialized = false;
  private reconnectAttempts = 0;
  private maxReconnects: number;
  private reconnectDelay: number;
  private onToolsChanged?: OnToolsChanged;
  private log;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.maxReconnects = config.maxReconnects ?? 3;
    this.reconnectDelay = config.reconnectDelay ?? 2000;
    this.log = childLogger({ component: "mcp-client", server: config.name });
  }

  setOnToolsChanged(cb: OnToolsChanged): void {
    this.onToolsChanged = cb;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.childProcess = spawn(this.config.command, this.config.args ?? [], {
        cwd: this.config.cwd ?? process.cwd(),
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!this.childProcess.stdout || !this.childProcess.stdin) {
        reject(new Error("Failed to create stdio pipes"));
        return;
      }

      let buffer = "";
      this.childProcess.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            this.handleLine(line.trim());
          }
        }
      });

      this.childProcess.stderr?.on("data", (data: Buffer) => {
        this.log.trace({ stderr: data.toString().slice(0, 200) }, "MCP stderr");
      });

      this.childProcess.on("error", (err) => {
        this.log.error({ error: err.message }, "MCP process error");
        reject(new Error(`MCP server error: ${err.message}`));
      });

      this.childProcess.on("exit", (code, signal) => {
        this.log.warn({ code, signal, wasInitialized: this.initialized }, "MCP process exited");
        this.initialized = false;
        this.rejectAllPending("MCP server disconnected");

        // Auto-reconnect
        if (this.reconnectAttempts < this.maxReconnects) {
          this.reconnectAttempts++;
          this.log.info({ attempt: this.reconnectAttempts, max: this.maxReconnects }, "attempting reconnect");
          setTimeout(() => {
            this.connect()
              .then(() => {
                this.log.info("reconnected successfully");
                this.reconnectAttempts = 0;
                this.onToolsChanged?.(this.config.name);
              })
              .catch((err) => {
                this.log.error({ error: String(err) }, "reconnect failed");
              });
          }, this.reconnectDelay);
        }
      });

      // Initialize handshake
      this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: true } },
        clientInfo: { name: "JimAgent", version: "0.4.0" },
      })
        .then(() => {
          // Send initialized notification per MCP spec
          this.sendNotification("notifications/initialized");
          this.initialized = true;
          this.reconnectAttempts = 0;
          return this.sendRequest("tools/list", {});
        })
        .then((result) => {
          const res = result as { tools?: MCPTool[] };
          this.tools = res.tools ?? [];
          this.log.info({ toolCount: this.tools.length }, "connected");
          resolve();
        })
        .catch(reject);
    });
  }

  private handleLine(line: string): void {
    try {
      const parsed = JSON.parse(line);

      // Check if it's a notification (no id)
      if (parsed.method && !("id" in parsed)) {
        this.handleNotification(parsed as JSONRPCNotification);
        return;
      }

      // It's a response
      const response = parsed as JSONRPCResponse;
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Not JSON, ignore
    }
  }

  private handleNotification(notification: JSONRPCNotification): void {
    if (notification.method === "notifications/tools/list_changed") {
      this.log.info("tools/list_changed notification received");
      this.refreshTools().catch((err) => {
        this.log.error({ error: String(err) }, "failed to refresh tools");
      });
    }
  }

  /** Re-fetch tools from the server */
  async refreshTools(): Promise<void> {
    if (!this.initialized) return;
    try {
      const result = await this.sendRequest("tools/list", {});
      const res = result as { tools?: MCPTool[] };
      const newTools = res.tools ?? [];
      const changed = newTools.length !== this.tools.length ||
        newTools.some((t, i) => t.name !== this.tools[i]?.name);
      this.tools = newTools;
      if (changed) {
        this.log.info({ toolCount: this.tools.length }, "tools refreshed");
        this.onToolsChanged?.(this.config.name);
      }
    } catch (err) {
      this.log.error({ error: String(err) }, "tool refresh failed");
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.childProcess?.stdin) return;
    const notification: JSONRPCNotification = { jsonrpc: "2.0", method, params };
    this.childProcess.stdin.write(JSON.stringify(notification) + "\n");
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.childProcess?.stdin) {
        reject(new Error("MCP server not connected"));
        return;
      }

      const id = ++this.requestId;
      const request: JSONRPCRequest = { jsonrpc: "2.0", id, method, params };

      this.pendingRequests.set(id, { resolve, reject });
      this.childProcess.stdin.write(JSON.stringify(request) + "\n");
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.initialized) throw new Error("MCP server not initialized");

    const result = await this.sendRequest("tools/call", {
      name,
      arguments: args,
    });

    const res = result as { content?: Array<{ type: string; text?: string }> };
    if (res.content) {
      return res.content.map((c) => c.text ?? "").join("\n");
    }

    return JSON.stringify(result);
  }

  getToolDefinitions(prefix: string): ToolDefinition[] {
    return this.tools.map((tool) => ({
      type: "function",
      function: {
        name: `${prefix}__${tool.name}`,
        description: tool.description ?? `MCP tool: ${tool.name}`,
        parameters: {
          type: "object",
          properties: (tool.inputSchema?.properties as Record<string, unknown>) ?? {},
          required: tool.inputSchema?.required ?? [],
        },
      },
    }));
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  isHealthy(): boolean {
    return this.initialized && this.childProcess !== undefined;
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnects; // Prevent reconnect
    this.childProcess?.kill();
    this.initialized = false;
  }
}

/**
 * MCP Manager — manages multiple MCP server connections.
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private configs = new Map<string, MCPServerConfig>();
  private log = childLogger({ component: "mcp-manager" });
  private onToolsChanged?: OnToolsChanged;

  setOnToolsChanged(cb: OnToolsChanged): void {
    this.onToolsChanged = cb;
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    this.configs.set(config.name, config);
    const client = new MCPClient(config);

    client.setOnToolsChanged((name) => {
      this.log.info({ server: name }, "tools changed, notifying");
      this.onToolsChanged?.(name);
    });

    try {
      await client.connect();
      this.clients.set(config.name, client);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error({ server: config.name, error: msg }, "failed to connect");
    }
  }

  /** Reconnect a specific server */
  async reconnectServer(name: string): Promise<boolean> {
    const config = this.configs.get(name);
    if (!config) return false;

    const existing = this.clients.get(name);
    if (existing) {
      existing.disconnect();
      this.clients.delete(name);
    }

    try {
      const client = new MCPClient(config);
      client.setOnToolsChanged((n) => this.onToolsChanged?.(n));
      await client.connect();
      this.clients.set(name, client);
      this.log.info({ server: name }, "reconnected");
      return true;
    } catch (err) {
      this.log.error({ server: name, error: String(err) }, "reconnect failed");
      return false;
    }
  }

  getAllToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const [name, client] of this.clients) {
      defs.push(...client.getToolDefinitions(name));
    }
    return defs;
  }

  getAllHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    for (const [serverName, client] of this.clients) {
      for (const tool of client.getTools()) {
        const prefixedName = `${serverName}__${tool.name}`;
        handlers.set(prefixedName, async (args) => {
          try {
            const result = await client.callTool(tool.name, args);
            return { content: result };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: `MCP error: ${msg}`, isError: true };
          }
        });
      }
    }
    return handlers;
  }

  /** Health check for all servers */
  healthCheck(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, client] of this.clients) {
      status[name] = client.isHealthy();
    }
    return status;
  }

  async loadFromConfig(configPath: string = ".mcp.json"): Promise<void> {
    try {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const content = await readFile(resolve(configPath), "utf-8");
      const config = JSON.parse(content) as { servers?: MCPServerConfig[]; mcpServers?: Record<string, Omit<MCPServerConfig, "name">> };

      if (config.servers) {
        for (const server of config.servers) {
          await this.addServer(server);
        }
      } else if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          await this.addServer({ ...serverConfig, name });
        }
      }
    } catch {
      // No config file or parse error — fine
    }
  }

  listServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /** Get a specific client by name */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /** Remove and disconnect a specific server */
  async removeServer(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) return false;
    client.disconnect();
    this.clients.delete(name);
    this.configs.delete(name);
    this.log.info({ server: name }, "server removed");
    this.onToolsChanged?.(name);
    return true;
  }

  /** Check if a server is loaded */
  hasServer(name: string): boolean {
    return this.clients.has(name);
  }

  /** Get detailed status of all servers */
  getServerStatus(): Array<{ name: string; healthy: boolean; toolCount: number; tools: string[] }> {
    const status: Array<{ name: string; healthy: boolean; toolCount: number; tools: string[] }> = [];
    for (const [name, client] of this.clients) {
      const tools = client.getTools();
      status.push({
        name,
        healthy: client.isHealthy(),
        toolCount: tools.length,
        tools: tools.map((t) => t.name),
      });
    }
    return status;
  }

  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}
