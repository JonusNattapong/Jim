import { describe, it, expect, vi } from "vitest";
import { spawnSubAgent, spawnParallelAgents, spawnBackground } from "./subagent.js";
import type { SubAgentConfig } from "./subagent.js";
import type { LLMProvider } from "./provider.js";

const mockProvider: LLMProvider = {
  name: "openai-compatible" as const,
  complete: async () => ({
    content: "done",
    toolCalls: [],
    finishReason: "stop",
  }),
  stream: async () => ({
    content: "done",
    toolCalls: [],
    finishReason: "stop",
  }),
};

const mockClient = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{ message: { content: "done" }, finish_reason: "stop" }],
      }),
    },
  },
} as any;

function makeConfig(overrides: Partial<SubAgentConfig> = {}): SubAgentConfig {
  return {
    type: "general",
    prompt: "Do something",
    client: mockClient,
    model: "gpt-4o",
    tools: [],
    toolExecutor: async () => ({ content: "tool result" }),
    ...overrides,
  };
}

describe("spawnSubAgent", () => {
  it("returns content when provider returns no tool calls", async () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => ({
        content: "task completed successfully",
        toolCalls: [],
        finishReason: "stop",
      }),
    };

    const result = await spawnSubAgent(
      makeConfig({ provider }),
    );

    expect(result).toBe("task completed successfully");
  });

  it("uses provider path when provider is set", async () => {
    const completeFn = vi.fn().mockResolvedValue({
      content: "provider result",
      toolCalls: [],
      finishReason: "stop",
    });

    const provider: LLMProvider = {
      ...mockProvider,
      complete: completeFn,
    };

    const result = await spawnSubAgent(
      makeConfig({ provider }),
    );

    expect(completeFn).toHaveBeenCalled();
    expect(result).toBe("provider result");
  });

  it("falls back to client path when no provider", async () => {
    const createFn = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "client result" }, finish_reason: "stop" }],
    });

    const client = {
      chat: { completions: { create: createFn } },
    } as any;

    const result = await spawnSubAgent(
      makeConfig({ client, provider: undefined }),
    );

    expect(createFn).toHaveBeenCalled();
    expect(result).toBe("client result");
  });

  it("executes tool calls and returns final result", async () => {
    const toolExecutor = vi.fn()
      .mockResolvedValueOnce({ content: "file content" })
      .mockResolvedValueOnce({ content: "command output" });

    let callCount = 0;
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            toolCalls: [
              { id: "call-1", name: "read_file", arguments: '{"path":"test.ts"}' },
            ],
            finishReason: "tool_calls",
          };
        }
        return {
          content: "final answer based on tools",
          toolCalls: [],
          finishReason: "stop",
        };
      },
    };

    const result = await spawnSubAgent(
      makeConfig({
        provider,
        toolExecutor,
        tools: [
          {
            type: "function",
            function: {
              name: "read_file",
              description: "Read a file",
              parameters: { type: "object", properties: {}, required: [] },
            },
          },
        ],
      }),
    );

    expect(toolExecutor).toHaveBeenCalledWith("read_file", { path: "test.ts" });
    expect(result).toBe("final answer based on tools");
  });

  it("injects context when provided", async () => {
    const completeFn = vi.fn().mockResolvedValue({
      content: "done with context",
      toolCalls: [],
      finishReason: "stop",
    });

    const provider: LLMProvider = {
      ...mockProvider,
      complete: completeFn,
    };

    await spawnSubAgent(
      makeConfig({
        provider,
        context: "Some important context",
        prompt: "Do the task",
      }),
    );

    const messages = completeFn.mock.calls[0][0];
    const userMsg = messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("[Context]");
    expect(userMsg.content).toContain("Some important context");
    expect(userMsg.content).toContain("[Task]");
    expect(userMsg.content).toContain("Do the task");
  });

  it("respects maxTurns", async () => {
    let callCount = 0;
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => {
        callCount++;
        return {
          content: "",
          toolCalls: [
            { id: `call-${callCount}`, name: "noop", arguments: "{}" },
          ],
          finishReason: "tool_calls",
        };
      },
    };

    const result = await spawnSubAgent(
      makeConfig({
        provider,
        maxTurns: 3,
        tools: [
          {
            type: "function",
            function: {
              name: "noop",
              description: "No-op",
              parameters: { type: "object", properties: {}, required: [] },
            },
          },
        ],
        toolExecutor: async () => ({ content: "ok" }),
      }),
    );

    expect(callCount).toBe(3);
    expect(result).toContain("max turns");
  });

  it("handles LLM errors gracefully", async () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => {
        throw new Error("API rate limited");
      },
    };

    const result = await spawnSubAgent(
      makeConfig({ provider }),
    );

    expect(result).toContain("Sub-agent error");
    expect(result).toContain("API rate limited");
  });

  it("returns message when no response from model", async () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => ({
        content: "",
        toolCalls: [],
        finishReason: "stop",
      }),
    };

    const result = await spawnSubAgent(
      makeConfig({ provider }),
    );

    expect(result).toBe("Sub-agent: No response from model");
  });
});

describe("spawnParallelAgents", () => {
  it("returns results in order", async () => {
    const configs = [
      makeConfig({
        prompt: "Task 1",
        provider: {
          ...mockProvider,
          complete: async () => ({ content: "result-1", toolCalls: [], finishReason: "stop" }),
        },
      }),
      makeConfig({
        prompt: "Task 2",
        provider: {
          ...mockProvider,
          complete: async () => ({ content: "result-2", toolCalls: [], finishReason: "stop" }),
        },
      }),
      makeConfig({
        prompt: "Task 3",
        provider: {
          ...mockProvider,
          complete: async () => ({ content: "result-3", toolCalls: [], finishReason: "stop" }),
        },
      }),
    ];

    const results = await spawnParallelAgents(configs);

    expect(results).toEqual(["result-1", "result-2", "result-3"]);
  });

  it("handles empty array", async () => {
    const results = await spawnParallelAgents([]);
    expect(results).toEqual([]);
  });
});

describe("spawnBackground", () => {
  it("returns running job with promise", () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => ({
        content: "background result",
        toolCalls: [],
        finishReason: "stop",
      }),
    };

    const job = spawnBackground(makeConfig({ provider }));

    expect(job.status).toBe("running");
    expect(job.role).toBe("general");
    expect(job.id).toMatch(/^bg-/);
    expect(job.promise).toBeInstanceOf(Promise);
  });

  it("resolves promise and updates job status", async () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => ({
        content: "background done",
        toolCalls: [],
        finishReason: "stop",
      }),
    };

    const job = spawnBackground(makeConfig({ provider }));
    const result = await job.promise;

    expect(result).toBe("background done");
    expect(job.status).toBe("done");
    expect(job.result).toBe("background done");
  });

  it("captures error message on LLM failure", async () => {
    const provider: LLMProvider = {
      ...mockProvider,
      complete: async () => {
        throw new Error("bg failure");
      },
    };

    const job = spawnBackground(makeConfig({ provider }));
    const result = await job.promise;

    expect(result).toContain("bg failure");
  });
});
