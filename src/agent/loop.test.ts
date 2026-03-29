import { describe, expect, it } from "vitest";
import { Agent } from "./loop.js";

describe("Agent provider presets", () => {
  it("prefers preset adapter over model heuristic in auto mode", () => {
    const agent = new Agent({
      apiKey: "local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "openai/gpt-5-mini",
      maxTurns: 1,
      maxToolOutput: 1000,
      projectRoot: process.cwd(),
      api: "auto",
      providerPreset: "ollama",
    });

    expect(agent.getRecommendedProviderForModel()).toBe("openai-compatible");
    expect(agent.getEffectiveProvider()).toBe("openai-compatible");
  });

  it("connects anthropic from explicit values", () => {
    const agent = new Agent({
      apiKey: "local",
      baseUrl: "https://api.openai.com/v1",
      model: "anthropic/claude-sonnet-4.6",
      maxTurns: 1,
      maxToolOutput: 1000,
      projectRoot: process.cwd(),
      api: "auto",
    });

    const result = agent.connectProviderPreset("anthropic", {
      apiKey: "sk-ant-test",
      baseUrl: "https://api.anthropic.com",
    });

    expect(result.ok).toBe(true);
    expect(agent.getEffectiveProvider()).toBe("anthropic");
    expect(agent.getProviderPreset()).toBe("anthropic");
  });
});
