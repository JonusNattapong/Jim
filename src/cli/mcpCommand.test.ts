import { describe, it, expect } from "vitest";
import handleMcpCommand from "./mcpCommand.js";

describe("/mcp command handler", () => {
  it("lists servers", async () => {
    const fakeAgent: any = {
      getMcpStatus: async () => [ { name: "s1", healthy: true, toolCount: 2, tools: ["t1", "t2"] } ],
      getPermissionMode: () => "edit",
    };

    const res = await handleMcpCommand(fakeAgent, "list");
    expect(res.type).toBe("list");
    if (res.type === "list") expect(res.items.length).toBeGreaterThan(0);
  });

  it("returns usage for unknown subcommands", async () => {
    const fakeAgent: any = { getMcpStatus: async () => [], getPermissionMode: () => "edit" };
    const res = await handleMcpCommand(fakeAgent, "unknowncmd");
    expect(res.type).toBe("info");
  });

  it("prevents add in plan mode", async () => {
    const fakeAgent: any = { getPermissionMode: () => "plan" };
    const res = await handleMcpCommand(fakeAgent, "add myserver echo");
    expect(res.type).toBe("error");
  });

  it("adds and removes and reconnects using agent methods", async () => {
    const fakeAgent: any = {
      getPermissionMode: () => "edit",
      addMcpServer: async (cfg: any) => ({ ok: true, message: `Added ${cfg.name}` }),
      removeMcpServer: async (name: string) => true,
      reconnectMcpServer: async (name: string) => true,
      loadMcpConfig: async (path?: string) => ({ ok: true, message: "Loaded MCP config" }),
    };

    const add = await handleMcpCommand(fakeAgent, "add myserver npx server");
    expect(add.type).toBe("success");

    const remove = await handleMcpCommand(fakeAgent, "remove myserver");
    expect(remove.type).toBe("success");

    const rc = await handleMcpCommand(fakeAgent, "reconnect myserver");
    expect(rc.type).toBe("success");

    const load = await handleMcpCommand(fakeAgent, "load .mcp.json");
    expect(load.type).toBe("success");
  });
});
