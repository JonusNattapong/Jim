import type { Agent } from "../agent/loop.js";

export type McpCommandResult =
  | { type: "info"; content: string }
  | { type: "list"; content: string; items: string[] }
  | { type: "success"; content: string }
  | { type: "error"; content: string };

export async function handleMcpCommand(agent: Agent, rawArgs: string): Promise<McpCommandResult> {
  const parts = rawArgs.trim().split(/\s+/).filter(Boolean);
  const sub = parts[0] || "list";

  try {
    if (sub === "list") {
      const status = await agent.getMcpStatus();
      if (!status || status.length === 0) return { type: "info", content: "No MCP servers configured" };
      const lines = status.map(s => `${s.name} | healthy=${s.healthy} | tools=${s.toolCount}`);
      return { type: "list", content: `MCP servers (${lines.length})`, items: lines };
    }

    if (sub === "status") {
      const name = parts[1];
      if (!name) return { type: "info", content: "usage: /mcp status <name>" };
      const status = await agent.getMcpStatus();
      const s = status.find(x => x.name === name);
      if (!s) return { type: "info", content: `no server ${name}` };
      return { type: "list", content: `Status: ${name}`, items: [`Name: ${s.name}`, `Healthy: ${s.healthy}`, `Tool count: ${s.toolCount}`, `Tools: ${s.tools.join(", ")}`] };
    }

    if (sub === "add") {
      // Validate permission mode: disallow adds in plan (read-only) mode
      const perm = agent.getPermissionMode();
      if (perm === "plan") return { type: "error", content: "Permission mode is 'plan' — cannot add MCP servers" };

      const name = parts[1];
      const command = parts[2];
      const cmdArgs = parts.slice(3);
      if (!name || !command) return { type: "info", content: "usage: /mcp add <name> <command> [args...]" };
      const res = await agent.addMcpServer({ name, command, args: cmdArgs });
      return res.ok ? { type: "success", content: `added ${name}` } : { type: "error", content: `error: ${res.message}` };
    }

    if (sub === "remove") {
      const name = parts[1];
      if (!name) return { type: "info", content: "usage: /mcp remove <name>" };
      const ok = await agent.removeMcpServer(name);
      return ok ? { type: "success", content: `removed ${name}` } : { type: "error", content: `failed to remove ${name}` };
    }

    if (sub === "reconnect") {
      const name = parts[1];
      if (!name) return { type: "info", content: "usage: /mcp reconnect <name>" };
      const ok = await agent.reconnectMcpServer(name);
      return ok ? { type: "success", content: `reconnected ${name}` } : { type: "error", content: `failed to reconnect ${name}` };
    }

    if (sub === "load") {
      const path = parts[1];
      const res = await agent.loadMcpConfig(path);
      return res.ok ? { type: "success", content: `loaded config` } : { type: "error", content: `error: ${res.message}` };
    }

    return { type: "info", content: `unknown subcommand: ${sub}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: "error", content: `/mcp failed: ${msg}` };
  }
}

export default handleMcpCommand;
