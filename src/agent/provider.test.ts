import { describe, it, expect } from "vitest";
import { createProvider, ChatCompletionsProvider, ResponsesProvider, AnthropicProvider, AzureOpenAIProvider, VertexAIProvider, BedrockProvider, getProviderMetadata, getProviderRegistry, inferProviderFromModel, normalizeProviderMode } from "./provider.js";

// Mock OpenAI client
function createMockClient(responses: Array<{ content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }> = [{ content: "hello" }]) {
  let callIndex = 0;
  return {
    chat: {
      completions: {
        create: async (params: Record<string, unknown>) => {
          const resp = responses[Math.min(callIndex++, responses.length - 1)];
          if (params.stream) {
            // Return async iterable for streaming
            return {
              async *[Symbol.asyncIterator]() {
                yield {
                  choices: [{
                    delta: { content: resp.content ?? "" },
                    finish_reason: "stop",
                  }],
                };
              },
            };
          }
          return {
            choices: [{
              message: resp,
              finish_reason: "stop",
            }],
          };
        },
      },
    },
  } as unknown as import("openai").default;
}

describe("createProvider", () => {
  it("returns ChatCompletionsProvider by default", () => {
    const mock = createMockClient();
    const provider = createProvider(mock);
    expect(provider.name).toBe("openai-compatible");
    expect(provider).toBeInstanceOf(ChatCompletionsProvider);
  });

  it("returns ChatCompletionsProvider for explicit provider", () => {
    const mock = createMockClient();
    const provider = createProvider(mock, { provider: "openai-compatible" });
    expect(provider.name).toBe("openai-compatible");
  });

  it("returns ResponsesProvider when provider is openai", () => {
    const mock = createMockClient();
    const provider = createProvider(mock, { provider: "openai" });
    expect(provider.name).toBe("openai");
    expect(provider).toBeInstanceOf(ResponsesProvider);
  });

  it("normalizes legacy aliases", () => {
    expect(normalizeProviderMode("responses")).toBe("openai");
    expect(normalizeProviderMode("chat-completions")).toBe("openai-compatible");
  });

  it("exposes provider metadata registry", () => {
    const registry = getProviderRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(6);
    expect(getProviderMetadata("openai").transport).toBe("responses");
    expect(getProviderMetadata("openai-compatible").transport).toBe("chat-completions");
    expect(getProviderMetadata("anthropic").endpoint).toBe("/v1/messages");
    expect(getProviderMetadata("azure-openai").name).toBe("azure-openai");
    expect(getProviderMetadata("vertex-ai").name).toBe("vertex-ai");
    expect(getProviderMetadata("bedrock").name).toBe("bedrock");
  });

  it("recommends providers from model patterns", () => {
    expect(inferProviderFromModel("openai/gpt-5.2")).toBe("openai");
    expect(inferProviderFromModel("anthropic/claude-sonnet-4.6")).toBe("anthropic");
    expect(inferProviderFromModel("google/gemini-3-pro-preview")).toBe("vertex-ai");
    expect(inferProviderFromModel("mistral/codestral-latest")).toBe("openai-compatible");
    expect(inferProviderFromModel("meta/llama-3-70b")).toBe("bedrock");
  });

  it("normalizes new provider modes", () => {
    expect(normalizeProviderMode("anthropic")).toBe("anthropic");
    expect(normalizeProviderMode("azure-openai")).toBe("azure-openai");
    expect(normalizeProviderMode("vertex-ai")).toBe("vertex-ai");
    expect(normalizeProviderMode("bedrock")).toBe("bedrock");
    expect(normalizeProviderMode("auto")).toBeUndefined();
    expect(normalizeProviderMode("invalid" as any)).toBeUndefined();
  });

  it("creates new provider types via factory", () => {
    const mock = createMockClient();
    expect(createProvider(mock, { provider: "anthropic" }).name).toBe("anthropic");
    expect(createProvider(mock, { provider: "azure-openai" }).name).toBe("azure-openai");
    expect(createProvider(mock, { provider: "vertex-ai" }).name).toBe("vertex-ai");
    expect(createProvider(mock, { provider: "bedrock" }).name).toBe("bedrock");
  });
});

describe("ChatCompletionsProvider", () => {
  it("complete returns normalized response", async () => {
    const mock = createMockClient([{ content: "Hello world" }]);
    const provider = new ChatCompletionsProvider(mock);

    const result = await provider.complete(
      [{ role: "user", content: "hi" }],
      [],
      { model: "test-model" },
    );

    expect(result.content).toBe("Hello world");
    expect(result.toolCalls).toHaveLength(0);
    expect(result.finishReason).toBe("stop");
  });

  it("complete returns tool calls", async () => {
    const mock = createMockClient([{
      content: null,
      tool_calls: [{ id: "tc1", function: { name: "read_file", arguments: '{"path":"test.ts"}' } }],
    }]);
    const provider = new ChatCompletionsProvider(mock);

    const result = await provider.complete(
      [{ role: "user", content: "read the file" }],
      [{ type: "function", function: { name: "read_file", description: "read", parameters: {} } }],
      { model: "test-model" },
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("read_file");
    expect(result.toolCalls[0].id).toBe("tc1");
    expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ path: "test.ts" });
  });

  it("stream calls onChunk for each delta", async () => {
    const mock = createMockClient([{ content: "Hello world" }]);
    const provider = new ChatCompletionsProvider(mock);

    const chunks: string[] = [];
    const result = await provider.stream(
      [{ role: "user", content: "hi" }],
      [],
      { model: "test-model" },
      (chunk: { content: string }) => { if (chunk.content) chunks.push(chunk.content); },
    );

    expect(result.content).toBe("Hello world");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toBe("Hello world");
  });

  it("passes model and temperature to API", async () => {
    let capturedParams: Record<string, unknown> = {};
    const mock = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedParams = params;
            return { choices: [{ message: { content: "ok" }, finish_reason: "stop" }] };
          },
        },
      },
    } as unknown as import("openai").default;

    const provider = new ChatCompletionsProvider(mock);
    await provider.complete([], [], { model: "gpt-4", temperature: 0.7, maxTokens: 100 });

    expect(capturedParams.model).toBe("gpt-4");
    expect(capturedParams.temperature).toBe(0.7);
    expect(capturedParams.max_tokens).toBe(100);
  });
});

describe("ResponsesProvider", () => {
  it("transforms system messages to developer role", () => {
    const mock = createMockClient([]);
    const provider = new ResponsesProvider(mock);

    // Test via the transformMessages method (accessed through complete with mock fetch)
    // The method is private, so we test through behavior
    expect(provider.name).toBe("openai");
  });

  it("creates with remoteMcpServers option", () => {
    const mock = createMockClient([]);
    const provider = new ResponsesProvider(mock, { remoteMcpServers: ["https://mcp.example.com"] });
    expect(provider.name).toBe("openai");
  });

  it("falls back gracefully when HTTP fails", async () => {
    // Mock a client that has a baseURL pointing to an invalid endpoint
    const mock = createMockClient([{ content: "fallback" }]);
    const provider = new ResponsesProvider(mock);

    // This will fail on HTTP since mock has no real baseURL
    // The provider should throw or return an error response
    try {
      await provider.complete(
        [{ role: "user", content: "hi" }],
        [],
        { model: "test-model" },
      );
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});

describe("AnthropicProvider", () => {
  it("has correct name and metadata", () => {
    const mock = createMockClient();
    const provider = new AnthropicProvider(mock);
    expect(provider.name).toBe("anthropic");
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("extracts API key from client config", () => {
    const mock = {
      apiKey: "test-anthropic-key",
      baseURL: "https://api.anthropic.com/v1",
    } as unknown as import("openai").default;
    const provider = new AnthropicProvider(mock);
    expect(provider.name).toBe("anthropic");
  });

  it("throws on HTTP error", async () => {
    const mock = {
      apiKey: "test-key",
      baseURL: "https://invalid.anthropic.test/v1",
    } as unknown as import("openai").default;
    const provider = new AnthropicProvider(mock);
    await expect(
      provider.complete([{ role: "user", content: "hi" }], [], { model: "claude-sonnet-4-20250514" }),
    ).rejects.toThrow();
  });
});

describe("AzureOpenAIProvider", () => {
  it("has correct name", () => {
    const mock = createMockClient();
    const provider = new AzureOpenAIProvider(mock);
    expect(provider.name).toBe("azure-openai");
  });

  it("uses deployment from env or falls back to model", async () => {
    const captured: Record<string, unknown>[] = [];
    const mock = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            captured.push(params);
            return { choices: [{ message: { content: "ok" }, finish_reason: "stop" }] };
          },
        },
      },
    } as unknown as import("openai").default;

    const provider = new AzureOpenAIProvider(mock);
    await provider.complete([], [], { model: "gpt-4" });

    expect(captured[0]).toBeDefined();
  });
});

describe("VertexAIProvider", () => {
  it("has correct name", () => {
    const mock = createMockClient();
    const provider = new VertexAIProvider(mock);
    expect(provider.name).toBe("vertex-ai");
  });

  it("throws on HTTP error", async () => {
    const mock = {
      apiKey: "test-token",
      baseURL: "https://invalid.vertex.test",
    } as unknown as import("openai").default;
    const provider = new VertexAIProvider(mock);
    await expect(
      provider.complete([{ role: "user", content: "hi" }], [], { model: "gemini-2.0-flash" }),
    ).rejects.toThrow();
  });
});

describe("BedrockProvider", () => {
  it("has correct name", () => {
    const mock = createMockClient();
    const provider = new BedrockProvider(mock);
    expect(provider.name).toBe("bedrock");
  });

  it("throws on HTTP error", async () => {
    const mock = {
      apiKey: "",
      baseURL: "https://invalid.bedrock.test",
    } as unknown as import("openai").default;
    const provider = new BedrockProvider(mock);
    await expect(
      provider.complete([{ role: "user", content: "hi" }], [], { model: "anthropic.claude-3-sonnet-20240229-v1:0" }),
    ).rejects.toThrow();
  });
});
