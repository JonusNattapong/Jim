import type { LocalCommandCall } from "../types.js";

const mcpServers = [
  { name: "github", description: "GitHub repository management" },
  { name: "slack", description: "Slack integration" },
  { name: "google-drive", description: "Google Drive access" },
  { name: "brave-search", description: "Web search" },
];

const call: LocalCommandCall = async (args, context) => {
  const parts = args.trim().split(/\s+/);
  const [action, serverName] = parts;

  if (!action || action === "list") {
    const items = mcpServers
      .map((s) => `- **${s.name}**: ${s.description}`)
      .join("\n");
    return {
      type: "text",
      value: `**Available MCP Servers**\n\n${items}\n\nUsage: /mcp [enable|disable] <server-name>`,
    };
  }

  if (action === "enable" && serverName) {
    const server = mcpServers.find((s) => s.name === serverName);
    if (!server) {
      return {
        type: "error",
        value: `Unknown server: ${serverName}`,
      };
    }
    return {
      type: "text",
      value: `✅ Enabled MCP server: **${serverName}**`,
    };
  }

  if (action === "disable" && serverName) {
    return {
      type: "text",
      value: `✅ Disabled MCP server: **${serverName}**`,
    };
  }

  return {
    type: "error",
    value: `Usage: /mcp [list|enable|disable] [server-name]`,
  };
};

export { call };
