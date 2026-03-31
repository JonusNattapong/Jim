/**
 * Real LSP Server Integration for Jim
 * Provides actual Language Server Protocol support instead of regex-based approach
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs/promises";

export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

export interface LSPLocation {
  uri: string;
  range: LSPRange;
}

export interface LSPSymbol {
  name: string;
  kind: SymbolKind;
  location: LSPLocation;
  containerName?: string;
  detail?: string;
  deprecated?: boolean;
}

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export interface LSPCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

export interface LSPDiagnostic {
  range: LSPRange;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

interface LSPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface LSPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface LSPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export class LSPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private buffer = "";
  private initialized = false;
  private serverCapabilities: Record<string, unknown> = {};

  constructor(
    private serverCommand: string,
    private serverArgs: string[] = [],
    private rootUri: string,
  ) {
    super();
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.serverCommand, this.serverArgs, {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: this.rootUri,
        });

        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on("data", (data: Buffer) => {
          this.emit("stderr", data.toString());
        });

        this.process.on("error", (err) => {
          this.emit("error", err);
          reject(err);
        });

        this.process.on("close", (code) => {
          this.emit("close", code);
          this.initialized = false;
        });

        // Initialize the LSP server
        this.initialize().then(resolve).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    while (true) {
      // Look for Content-Length header
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/i);
      if (!contentLengthMatch) {
        this.buffer = this.buffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEnd + 4;

      if (this.buffer.length < messageStart + contentLength) break;

      const messageContent = this.buffer.substring(
        messageStart,
        messageStart + contentLength,
      );
      this.buffer = this.buffer.substring(messageStart + contentLength);

      try {
        const message = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (err) {
        this.emit("parseError", err, messageContent);
      }
    }
  }

  private handleMessage(message: LSPResponse | LSPNotification): void {
    if ("id" in message) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      // Notification from server
      this.emit("notification", message.method, message.params);

      // Handle specific notifications
      switch (message.method) {
        case "textDocument/publishDiagnostics":
          this.emit("diagnostics", message.params);
          break;
        case "window/logMessage":
          this.emit("logMessage", message.params);
          break;
        case "window/showMessage":
          this.emit("showMessage", message.params);
          break;
      }
    }
  }

  private sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error("LSP server not started"));
        return;
      }

      const id = ++this.requestId;
      const request: LSPRequest = { jsonrpc: "2.0", id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      const content = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
      this.process.stdin.write(header + content);
    });
  }

  private sendNotification(method: string, params?: unknown): void {
    if (!this.process || !this.process.stdin) return;

    const notification: LSPNotification = { jsonrpc: "2.0", method, params };
    const content = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.process.stdin.write(header + content);
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest("initialize", {
      processId: process.pid,
      rootUri: `file://${this.rootUri}`,
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: true },
          synchronization: { didSave: true },
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: {},
          codeAction: {},
          rename: {},
        },
        workspace: {
          symbol: {},
          workspaceFolders: true,
        },
      },
      initializationOptions: {},
    });

    this.serverCapabilities = (result as any)?.capabilities ?? {};
    this.initialized = true;

    this.sendNotification("initialized", {});
    this.emit("initialized", this.serverCapabilities);
  }

  async openDocument(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): Promise<void> {
    this.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text },
    });
  }

  async updateDocument(
    uri: string,
    version: number,
    text: string,
  ): Promise<void> {
    this.sendNotification("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  async saveDocument(uri: string): Promise<void> {
    this.sendNotification("textDocument/didSave", { textDocument: { uri } });
  }

  async closeDocument(uri: string): Promise<void> {
    this.sendNotification("textDocument/didClose", { textDocument: { uri } });
  }

  async getDocumentSymbols(uri: string): Promise<LSPSymbol[]> {
    const result = await this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    return (result as LSPSymbol[]) ?? [];
  }

  async getWorkspaceSymbols(query: string): Promise<LSPSymbol[]> {
    const result = await this.sendRequest("workspace/symbol", { query });
    return (result as LSPSymbol[]) ?? [];
  }

  async findDefinition(
    uri: string,
    position: LSPPosition,
  ): Promise<LSPLocation[]> {
    const result = await this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position,
    });

    // Result can be Location or Location[]
    if (Array.isArray(result)) return result as LSPLocation[];
    if (result) return [result as LSPLocation];
    return [];
  }

  async findReferences(
    uri: string,
    position: LSPPosition,
    includeDeclaration = true,
  ): Promise<LSPLocation[]> {
    const result = await this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    });
    return (result as LSPLocation[]) ?? [];
  }

  async getHover(uri: string, position: LSPPosition): Promise<string | null> {
    const result = await this.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position,
    });

    if (!result) return null;
    const hover = result as {
      contents?: string | { value: string } | Array<string | { value: string }>;
    };

    if (typeof hover.contents === "string") return hover.contents;
    if (typeof hover.contents === "object" && "value" in hover.contents)
      return hover.contents.value;
    if (Array.isArray(hover.contents)) {
      return hover.contents
        .map((c) => (typeof c === "string" ? c : c.value))
        .join("\n");
    }
    return null;
  }

  async getCompletions(
    uri: string,
    position: LSPPosition,
  ): Promise<LSPCompletionItem[]> {
    const result = await this.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position,
    });

    if (!result) return [];
    const completionList = result as
      | { items?: LSPCompletionItem[] }
      | LSPCompletionItem[];
    if (Array.isArray(completionList)) return completionList;
    return completionList.items ?? [];
  }

  async getCodeActions(
    uri: string,
    range: LSPRange,
    diagnostics: LSPDiagnostic[],
  ): Promise<unknown[]> {
    const result = await this.sendRequest("textDocument/codeAction", {
      textDocument: { uri },
      range,
      context: { diagnostics },
    });
    return (result as unknown[]) ?? [];
  }

  async rename(
    uri: string,
    position: LSPPosition,
    newName: string,
  ): Promise<unknown> {
    return this.sendRequest("textDocument/rename", {
      textDocument: { uri },
      position,
      newName,
    });
  }

  async getDiagnostics(uri: string): Promise<LSPDiagnostic[]> {
    // Diagnostics are typically pushed by the server, not requested
    // But we can return cached diagnostics
    return [];
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCapabilities(): Record<string, unknown> {
    return this.serverCapabilities;
  }

  async stop(): Promise<void> {
    if (this.process) {
      try {
        await this.sendRequest("shutdown");
        this.sendNotification("exit");
      } catch {
        // Ignore shutdown errors
      }
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }
}

/**
 * Language Server configurations for different languages
 */
export const LANGUAGE_SERVERS: Record<
  string,
  { command: string; args: string[]; languages: string[] }
> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"],
    languages: [
      "typescript",
      "typescriptreact",
      "javascript",
      "javascriptreact",
    ],
  },
  python: {
    command: "pylsp",
    args: [],
    languages: ["python"],
  },
  rust: {
    command: "rust-analyzer",
    args: [],
    languages: ["rust"],
  },
  go: {
    command: "gopls",
    args: [],
    languages: ["go"],
  },
  cpp: {
    command: "clangd",
    args: [],
    languages: ["c", "cpp", "objective-c", "objective-cpp"],
  },
  java: {
    command: "jdtls",
    args: [],
    languages: ["java"],
  },
  ruby: {
    command: "solargraph",
    args: ["stdio"],
    languages: ["ruby"],
  },
  php: {
    command: "intelephense",
    args: ["--stdio"],
    languages: ["php"],
  },
};

/**
 * Get language ID from file extension
 */
export function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".java": "java",
    ".rb": "ruby",
    ".php": "php",
  };
  return langMap[ext] ?? "plaintext";
}

/**
 * Find appropriate language server for a file
 */
export function findLanguageServer(
  filePath: string,
): { command: string; args: string[] } | null {
  const langId = getLanguageId(filePath);

  for (const config of Object.values(LANGUAGE_SERVERS)) {
    if (config.languages.includes(langId)) {
      return { command: config.command, args: config.args };
    }
  }

  return null;
}
