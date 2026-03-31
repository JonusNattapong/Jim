/**
 * MCP Resources Tool for Jim
 * Discover and access resources from MCP servers
 */

import type { ToolDefinition, ToolHandler } from "./types.js";

export const list_mcp_resources_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "list_mcp_resources",
    description:
      "List available resources from connected MCP servers. Resources can include files, data streams, API endpoints, and other content provided by MCP servers.",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Filter by specific MCP server name (optional)",
        },
        type: {
          type: "string",
          description: "Filter by resource type (optional)",
        },
      },
      required: [],
    },
  },
};

export const list_mcp_resources_handler: ToolHandler = async (
  args: any,
  context,
) => {
  try {
    const server = args.server as string | undefined;
    const type = args.type as string | undefined;

    // Try to get MCP manager from context or global
    let mcpManager: any = null;
    try {
      if (context?.registry) {
        mcpManager = context.registry.getMcpManager?.();
      }
    } catch {
      // MCP manager not available
    }

    if (mcpManager) {
      const resources: any[] = [];
      const servers = mcpManager.getServers?.() ?? [];

      for (const srv of servers) {
        if (server && srv.name !== server) continue;

        try {
          const srvResources = await srv.listResources?.();
          if (srvResources) {
            for (const res of srvResources) {
              if (type && res.type !== type) continue;
              resources.push({
                server: srv.name,
                uri: res.uri,
                name: res.name ?? res.uri,
                type: res.type ?? "unknown",
                mimeType: res.mimeType,
                description: res.description,
              });
            }
          }
        } catch {
          // Skip failed servers
        }
      }

      if (resources.length > 0) {
        const lines = ["📦 **MCP Resources**", ""];
        let currentServer = "";
        for (const res of resources) {
          if (res.server !== currentServer) {
            currentServer = res.server;
            lines.push(`### ${currentServer}`);
          }
          const mime = res.mimeType ? ` (${res.mimeType})` : "";
          const desc = res.description ? ` - ${res.description}` : "";
          lines.push(`- \`${res.uri}\`${mime}${desc}`);
        }
        return { content: lines.join("\n") };
      }
    }

    // Fallback: show available info
    const info = [
      "📦 **MCP Resources**",
      "",
      "MCP servers can provide resources such as:",
      "- Files and documents",
      "- Data streams and feeds",
      "- API endpoints",
      "- Database connections",
      "- External service integrations",
      "",
      server
        ? `Filtering by server: ${server}`
        : "Use the MCP tool to manage server connections.",
      "",
      "To discover resources, ensure MCP servers are connected using `/mcp status`.",
      "",
      "Note: Resource listing requires MCP server to support the `resources/list` capability.",
    ];

    return {
      content: info.join("\n"),
    };
  } catch (err: any) {
    return {
      content: `Failed to list MCP resources: ${err.message}`,
      isError: true,
    };
  }
};
