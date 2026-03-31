/**
 * LSP Server Manager
 * 
 * Inspired by Claude Code's Language Server Protocol integration
 * that provides code intelligence (completions, definitions, etc.)
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * LSP server configuration
 */
export interface LSPServerConfig {
  /** Server name */
  name: string;
  /** Command to start the server */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** File extensions this server handles */
  fileExtensions: string[];
  /** Languages this server supports */
  languages: string[];
}

/**
 * LSP server instance
 */
export interface LSPServerInstance {
  config: LSPServerConfig;
  isRunning: boolean;
  pid?: number;
  startedAt?: number;
}

/**
 * LSP server manager
 */
export interface LSPServerManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getServerForFile(filePath: string): LSPServerInstance | undefined;
  ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined>;
  sendRequest<T>(filePath: string, method: string, params: unknown): Promise<T | undefined>;
  openFile(filePath: string, content: string): Promise<void>;
  changeFile(filePath: string, content: string): Promise<void>;
  saveFile(filePath: string): Promise<void>;
  closeFile(filePath: string): Promise<void>;
}

// ============================================================================
// Built-in LSP Server Configurations
// ============================================================================

/**
 * TypeScript/JavaScript LSP server
 */
export const TYPESCRIPT_LSP: LSPServerConfig = {
  name: "typescript",
  command: "typescript-language-server",
  args: ["--stdio"],
  fileExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  languages: ["typescript", "javascript"],
};

/**
 * Python LSP server
 */
export const PYTHON_LSP: LSPServerConfig = {
  name: "python",
  command: "pylsp",
  fileExtensions: [".py", ".pyi"],
  languages: ["python"],
};

/**
 * Rust LSP server
 */
export const RUST_LSP: LSPServerConfig = {
  name: "rust",
  command: "rust-analyzer",
  fileExtensions: [".rs"],
  languages: ["rust"],
};

/**
 * Go LSP server
 */
export const GO_LSP: LSPServerConfig = {
  name: "go",
  command: "gopls",
  fileExtensions: [".go"],
  languages: ["go"],
};

/**
 * All built-in LSP servers
 */
export const BUILTIN_LSP_SERVERS: LSPServerConfig[] = [
  TYPESCRIPT_LSP,
  PYTHON_LSP,
  RUST_LSP,
  GO_LSP,
];

// ============================================================================
// LSP Manager Factory
// ============================================================================

/**
 * Create an LSP server manager
 */
export function createLSPServerManager(
  customServers: LSPServerConfig[] = []
): LSPServerManager {
  const servers = new Map<string, LSPServerInstance>();
  const extensionMap = new Map<string, string>();
  const openedFiles = new Map<string, string>();

  // Register all servers
  const allServers = [...BUILTIN_LSP_SERVERS, ...customServers];
  for (const server of allServers) {
    for (const ext of server.fileExtensions) {
      extensionMap.set(ext, server.name);
    }
  }

  return {
    async initialize(): Promise<void> {
      // Initialize LSP manager
    },

    async shutdown(): Promise<void> {
      for (const server of servers.values()) {
        server.isRunning = false;
      }
      servers.clear();
      openedFiles.clear();
    },

    getServerForFile(filePath: string): LSPServerInstance | undefined {
      const ext = filePath.slice(filePath.lastIndexOf("."));
      const serverName = extensionMap.get(ext);
      return serverName ? servers.get(serverName) : undefined;
    },

    async ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined> {
      const server = this.getServerForFile(filePath);
      if (server?.isRunning) return server;

      const ext = filePath.slice(filePath.lastIndexOf("."));
      const serverName = extensionMap.get(ext);
      if (!serverName) return undefined;

      const config = allServers.find((s) => s.name === serverName);
      if (!config) return undefined;

      // Create new instance
      const instance: LSPServerInstance = {
        config,
        isRunning: true,
        startedAt: Date.now(),
      };

      servers.set(serverName, instance);
      return instance;
    },

    async sendRequest<T>(
      filePath: string,
      method: string,
      params: unknown
    ): Promise<T | undefined> {
      const server = this.getServerForFile(filePath);
      if (!server?.isRunning) return undefined;

      // In production, this would send JSON-RPC request to the LSP server
      return undefined;
    },

    async openFile(filePath: string, content: string): Promise<void> {
      openedFiles.set(filePath, content);
      const server = await this.ensureServerStarted(filePath);
      if (server) {
        // Send didOpen notification
      }
    },

    async changeFile(filePath: string, content: string): Promise<void> {
      openedFiles.set(filePath, content);
      // Send didChange notification
    },

    async saveFile(filePath: string): Promise<void> {
      // Send didSave notification
    },

    async closeFile(filePath: string): Promise<void> {
      openedFiles.delete(filePath);
      // Send didClose notification
    },
  };
}

// ============================================================================
// LSP Utilities
// ============================================================================

/**
 * Detect language from file path
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
  };
  return languageMap[ext] ?? "plaintext";
}

/**
 * Get LSP server for language
 */
export function getLSPServerForLanguage(
  language: string,
  servers: LSPServerConfig[]
): LSPServerConfig | undefined {
  return servers.find((s) => s.languages.includes(language));
}

// ============================================================================
// Exports
// ============================================================================

export const LSP = {
  createLSPServerManager,
  detectLanguage,
  getLSPServerForLanguage,
  BUILTIN_LSP_SERVERS,
} as const;