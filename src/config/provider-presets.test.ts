import { describe, expect, it } from "vitest";
import { resolveProviderPreset } from "./provider-presets.js";

describe("provider-presets", () => {
  it("resolves newer openai-compatible presets from saved values", () => {
    const minimax = resolveProviderPreset("minimax", {}, { apiKey: "mm-key" });
    const scaleway = resolveProviderPreset("scaleway", {}, { apiKey: "scw-key" });
    const venice = resolveProviderPreset("venice-ai", {}, { apiKey: "ven-key" });

    expect(minimax?.configured).toBe(true);
    expect(minimax?.adapter).toBe("openai-compatible");
    expect(minimax?.resolvedBaseUrl).toBe("https://api.minimax.io/v1");

    expect(scaleway?.configured).toBe(true);
    expect(scaleway?.resolvedBaseUrl).toBe("https://api.scaleway.ai/v1");

    expect(venice?.configured).toBe(true);
    expect(venice?.resolvedBaseUrl).toBe("https://api.venice.ai/api/v1");
  });
});
