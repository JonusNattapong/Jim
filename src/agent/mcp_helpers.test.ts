import { describe, it, expect } from "vitest";
import { Agent } from "./loop.js";

const baseConfig = {
  apiKey: "",
  baseUrl: "http://localhost",
  model: "test-model",
  maxTurns: 1,
  maxToolOutput: 1024,
  projectRoot: process.cwd(),
};

describe("Agent MCP helper wrappers", () => {
  it("returns defaults when MCP manager is unavailable", async () => {
    const agent = new Agent(baseConfig as any);
    expect(await agent.listMcpServers()).toEqual([]);
    expect(await agent.getMcpStatus()).toEqual([]);
    expect(await agent.addMcpServer({ name: "x", command: "c" } as any)).toEqual({ ok: false, message: "MCP manager not available" });
    expect(await agent.removeMcpServer("x")).toBe(false);
    expect(await agent.reconnectMcpServer("x")).toBe(false);
    expect(await agent.loadMcpConfig()).toEqual({ ok: false, message: "MCP manager not available" });
  });

  it("delegates to MCP manager when present", async () => {
    const agent = new Agent(baseConfig as any);

    const mockMcp = {
      listServers: () => ["a", "b"],
      getServerStatus: () => [{ name: "a", healthy: true, toolCount: 1, tools: ["t1"] }],
      addServer: async (cfg: any) => { /* no-op */ },
      removeServer: async (name: string) => true,
      reconnectServer: async (name: string) => true,
      loadFromConfig: async (path?: string) => { /* no-op */ },
    } as any;

    (agent as any).mcp = mockMcp;

    expect(await agent.listMcpServers()).toEqual(["a", "b"]);
    expect(await agent.getMcpStatus()).toEqual([{ name: "a", healthy: true, toolCount: 1, tools: ["t1"] }]);

    const addRes = await agent.addMcpServer({ name: "x", command: "c" } as any);
    expect(addRes.ok).toBe(true);
    expect(addRes.message).toBe("Added x");

    expect(await agent.removeMcpServer("a")).toBe(true);
    expect(await agent.reconnectMcpServer("a")).toBe(true);

    const loadRes = await agent.loadMcpConfig();
    expect(loadRes.ok).toBe(true);
    expect(loadRes.message).toBe("Loaded MCP config");
  });
});
