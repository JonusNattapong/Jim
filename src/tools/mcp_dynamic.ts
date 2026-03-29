import type { ToolDefinition, ToolHandler, ToolResult } from "./types.js";
import type { MCPManager } from "./mcp.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "mcp-dynamic-tool" });

/** Well-known MCP server presets from modelcontextprotocol/servers */
const MCP_SERVER_PRESETS: Record<string, { command: string; args: string[]; description: string }> = {
  postgres: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    description: "PostgreSQL read-only database access with schema inspection",
  },
  sqlite: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    description: "SQLite database interaction and business intelligence",
  },
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    description: "Secure file operations with configurable access controls",
  },
  fetch: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    description: "Web content fetching and conversion for LLM usage",
  },
  memory: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    description: "Knowledge graph-based persistent memory system",
  },
  git: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
    description: "Tools to read, search, and manipulate Git repositories",
  },
  sequentialthinking: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequentialthinking"],
    description: "Dynamic problem-solving through thought sequences",
  },
  time: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-time"],
    description: "Time and timezone conversion capabilities",
  },
  redis: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-redis"],
    description: "Interact with Redis key-value stores",
  },
  puppeteer: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    description: "Browser automation and web scraping with Puppeteer",
  },
  brave_search: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    description: "Web and local search using Brave Search API",
  },
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    description: "Repository management, file operations, and GitHub API integration",
  },
  slack: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    description: "Channel management and messaging on Slack",
  },
  google_drive: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    description: "File access and search for Google Drive",
  },
  google_maps: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    description: "Location services, directions, and place details",
  },
  sentry: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sentry"],
    description: "Retrieving and analyzing issues from Sentry.io",
  },
};

/**
 * Build the mcp_manager tool definition.
 */
export function buildMcpManagerDefinition(presetNames: string[]): ToolDefinition {
  const presetList = presetNames.map((n) => {
    const preset = MCP_SERVER_PRESETS[n];
    return preset ? `- '${n}': ${preset.description}` : `- '${n}'`;
  }).join("\n");

  return {
    type: "function",
    function: {
      name: "mcp_manager",
      description:
        "Dynamically load or unload MCP servers on-the-fly. " +
        "Use this when a task requires tools not available as built-ins (e.g. database queries, browser automation). " +
        "Loaded servers register their tools automatically and can be used immediately. " +
        "Unload servers when done to keep the system lightweight.\n\n" +
        "Available presets:\n" + presetList,
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["load", "unload", "status", "list_presets"],
            description: "Action to perform: 'load' connects an MCP server, 'unload' disconnects it, 'status' shows all loaded servers, 'list_presets' shows available presets.",
          },
          server_name: {
            type: "string",
            description: "For 'load': preset name or custom server name. For 'unload': name of loaded server to disconnect.",
          },
          command: {
            type: "string",
            description: "For custom servers (not presets): the command to run the MCP server.",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "For custom servers: arguments to pass to the command.",
          },
          env: {
            type: "object",
            description: "Optional environment variables for the server process.",
          },
          connection_string: {
            type: "string",
            description: "For database servers (postgres): the connection string passed as the first arg.",
          },
        },
        required: ["action"],
      },
    },
  };
}

/**
 * Build the mcp_manager tool handler.
 */
export function buildMcpManagerHandler(mcp: MCPManager, reRegisterTools: () => void): ToolHandler {
  return async (args): Promise<ToolResult> => {
    const action = args.action as string;

    switch (action) {
      case "list_presets": {
        const lines = Object.entries(MCP_SERVER_PRESETS).map(
          ([name, preset]) => `- **${name}**: ${preset.description}\n  Command: ${preset.command} ${preset.args.join(" ")}`,
        );
        return { content: `Available MCP server presets:\n\n${lines.join("\n")}` };
      }

      case "status": {
        const status = mcp.getServerStatus();
        if (status.length === 0) {
          return { content: "No MCP servers currently loaded." };
        }
        const lines = status.map((s) =>
          `- **${s.name}**: ${s.healthy ? "✅ healthy" : "❌ unhealthy"}, ${s.toolCount} tools [${s.tools.join(", ")}]`,
        );
        return { content: `Loaded MCP servers (${status.length}):\n\n${lines.join("\n")}` };
      }

      case "load": {
        const serverName = args.server_name as string;
        if (!serverName) {
          return { content: "Error: 'server_name' is required for 'load' action", isError: true };
        }

        // Check if already loaded
        if (mcp.hasServer(serverName)) {
          return { content: `MCP server '${serverName}' is already loaded. Use 'status' to see its tools.` };
        }

        // Check if it's a preset
        const preset = MCP_SERVER_PRESETS[serverName];
        if (preset) {
          try {
            const finalArgs = [...preset.args];

            // For database servers, append connection string if provided
            if (args.connection_string && (serverName === "postgres" || serverName === "redis")) {
              finalArgs.push(args.connection_string as string);
            }

            await mcp.addServer({
              name: serverName,
              command: preset.command,
              args: finalArgs,
              env: args.env as Record<string, string> | undefined,
              maxReconnects: 1,
              reconnectDelay: 5000,
            });

            reRegisterTools();

            const client = mcp.getClient(serverName);
            const tools = client?.getTools() ?? [];
            return {
              content: `✅ MCP server '${serverName}' loaded successfully.\n` +
                `${tools.length} tools available: [${tools.map((t) => t.name).join(", ")}]\n` +
                `Tools are prefixed with '${serverName}__' (e.g. '${serverName}__${tools[0]?.name ?? "query"}')`,
            };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: `Failed to load MCP server '${serverName}': ${msg}`, isError: true };
          }
        }

        // Custom server
        const command = args.command as string;
        if (!command) {
          return {
            content: `Error: Unknown preset '${serverName}'. Either use a known preset or provide 'command' for a custom MCP server.\n` +
              `Available presets: ${Object.keys(MCP_SERVER_PRESETS).join(", ")}`,
            isError: true,
          };
        }

        try {
          await mcp.addServer({
            name: serverName,
            command,
            args: (args.args as string[]) ?? [],
            env: args.env as Record<string, string> | undefined,
            maxReconnects: 1,
            reconnectDelay: 5000,
          });

          reRegisterTools();

          const client = mcp.getClient(serverName);
          const tools = client?.getTools() ?? [];
          return {
            content: `✅ Custom MCP server '${serverName}' loaded. ${tools.length} tools: [${tools.map((t) => t.name).join(", ")}]`,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Failed to load custom MCP server '${serverName}': ${msg}`, isError: true };
        }
      }

      case "unload": {
        const serverName = args.server_name as string;
        if (!serverName) {
          return { content: "Error: 'server_name' is required for 'unload' action", isError: true };
        }

        const removed = await mcp.removeServer(serverName);
        if (removed) {
          reRegisterTools();
          return { content: `✅ MCP server '${serverName}' unloaded. Tools removed from registry.` };
        }
        return { content: `MCP server '${serverName}' not found. Use 'status' to see loaded servers.`, isError: true };
      }

      default:
        return { content: `Unknown action: ${action}. Use 'load', 'unload', 'status', or 'list_presets'.`, isError: true };
    }
  };
}

export { MCP_SERVER_PRESETS };
