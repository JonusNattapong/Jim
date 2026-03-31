import type { ToolDefinition, ToolHandler, ToolResult } from "./types.js";

export const list_plugins_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "list_plugins",
    description:
      "List built-in capabilities and connected MCP plugins/extensions. " +
      "Use when the user asks what integrations or plugins are available.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const list_plugins_handler: ToolHandler = async (args, context) => {
  if (!context?.registry) {
    return { content: "Internal error: registry not found in context.", isError: true };
  }

  const registry = context.registry;
  const pm = registry.getPluginManager();
  const plugins = pm.getAllPlugins();
  
  let content = "Installed Plugins & Capabilities:\n\n";

  for (const metadata of plugins) {
    const plugin = pm.getPlugin(metadata.name);
    const status = plugin?.enabled ? "[ENABLED]" : "[DISABLED]";
    content += `${status} ${metadata.name} v${metadata.version} by ${metadata.author ?? "Jim"}\n`;
    content += `Description: ${metadata.description}\n`;
    
    if (plugin && plugin.tools.length > 0) {
      const toolNames = plugin.tools.map((t: { definition: ToolDefinition }) => t.definition.function.name).join(", ");
      content += `Tools: ${toolNames}\n`;
    }
    content += "\n";
  }

  content += "GraphRAG & Advanced Features:\n";
  content += "- Graph indexing, relationship tracing, and impact analysis via 'graph_query'\n";
  content += "- Autonomous sub-agents via 'spawn_agent'\n";
  content += "- Dynamic MCP server management via 'mcp' tools\n";

  return { content };
};
