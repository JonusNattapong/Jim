import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProviderSettings, loadSavedProviderSelection, saveProviderSelection, saveProviderSettings } from "./provider-store.js";

describe("provider-store", () => {
  it("persists selected preset and settings", () => {
    const root = mkdtempSync(join(tmpdir(), "jim-provider-store-"));
    saveProviderSelection(root, "openrouter");
    saveProviderSettings(root, "openrouter", {
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    expect(loadSavedProviderSelection(root)).toBe("openrouter");
    expect(loadProviderSettings(root, "openrouter")).toEqual({
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });
});
