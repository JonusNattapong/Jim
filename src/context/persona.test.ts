import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UserPersonaManager, type UserPersona } from "./persona.js";

describe("UserPersonaManager", () => {
  let tempDir: string;
  let manager: UserPersonaManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jim-test-"));
    manager = new UserPersonaManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("default persona", () => {
    it("has empty arrays and default communication style", () => {
      const persona = manager.getPersona();
      expect(persona.codingStyle).toEqual([]);
      expect(persona.preferences).toEqual([]);
      expect(persona.knownConcepts).toEqual([]);
      expect(persona.toolUsagePatterns).toEqual({});
      expect(persona.communicationStyle).toBe("Direct and technical");
    });
  });

  describe("updateFromReflection()", () => {
    it("merges codingStyle with dedup", () => {
      manager.updateFromReflection({ codingStyle: ["functional", "typed"] });
      manager.updateFromReflection({ codingStyle: ["typed", "minimal"] });
      const persona = manager.getPersona();
      expect(persona.codingStyle).toEqual(["functional", "typed", "minimal"]);
    });

    it("overwrites communicationStyle", () => {
      manager.updateFromReflection({ communicationStyle: "Casual and friendly" });
      const persona = manager.getPersona();
      expect(persona.communicationStyle).toBe("Casual and friendly");
    });
  });

  describe("recordToolUsage()", () => {
    it("increments counter", () => {
      manager.recordToolUsage("bash");
      manager.recordToolUsage("bash");
      manager.recordToolUsage("read");
      const persona = manager.getPersona();
      expect(persona.toolUsagePatterns["bash"]).toBe(2);
      expect(persona.toolUsagePatterns["read"]).toBe(1);
    });
  });

  describe("buildPromptFragment()", () => {
    it("returns empty string with default persona", () => {
      const fragment = manager.buildPromptFragment();
      expect(fragment).toBe("");
    });

    it("returns formatted string after updates", () => {
      manager.updateFromReflection({ codingStyle: ["functional"] });
      const fragment = manager.buildPromptFragment();
      expect(fragment).toContain("USER MODEL");
      expect(fragment).toContain("functional");
    });
  });

  describe("save() and load()", () => {
    it("round-trips persona data", async () => {
      manager.updateFromReflection({ codingStyle: ["test-driven"] });
      manager.recordToolUsage("bash");
      await manager.save();

      const manager2 = new UserPersonaManager(tempDir);
      await manager2.load();
      const persona = manager2.getPersona();
      expect(persona.codingStyle).toContain("test-driven");
      expect(persona.toolUsagePatterns["bash"]).toBe(1);
    });

    it("load() handles missing file gracefully", async () => {
      const manager2 = new UserPersonaManager(tempDir);
      await manager2.load();
      const persona = manager2.getPersona();
      expect(persona.codingStyle).toEqual([]);
      expect(persona.communicationStyle).toBe("Direct and technical");
    });
  });
});
