import type { EnhancedCommandDefinition } from "../types.js";

const mcp = {
  type: "local",
  name: "mcp",
  description: "Manage MCP (Model Context Protocol) servers",
  argumentHint: "[list|enable|disable] [server-name]",
  category: "mcp",
  supportsNonInteractive: true,
  load: () => import("./mcp.js"),
} satisfies EnhancedCommandDefinition;

export default mcp;
