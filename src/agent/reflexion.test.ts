import { describe, it, expect, beforeEach } from "vitest";
import { ReflexionEngine } from "./reflexion.js";
import type { LLMProvider } from "./provider.js";

const mockProvider: LLMProvider = {
  name: "openai-compatible" as const,
  complete: async () => ({
    content: JSON.stringify({
      rootCause: "Missing file",
      diagnosis: "File was not created before editing",
      suggestedFix: "Create the file first",
      confidence: 0.9,
    }),
    toolCalls: [],
    finishReason: "stop",
  }),
  stream: async () => ({ content: "", toolCalls: [], finishReason: "stop" }),
};

function createEngine(overrides?: {
  errorThreshold?: number;
  reflectionCooldown?: number;
}) {
  return new ReflexionEngine(
    mockProvider,
    "gpt-4o",
    overrides?.errorThreshold ?? 2,
    overrides?.reflectionCooldown ?? 3,
  );
}

describe("ReflexionEngine", () => {
  let engine: ReflexionEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("recordError", () => {
    it("increments consecutive failures", () => {
      engine.recordError(1, "bash", "command failed: exit 1", "running tests");
      expect(engine.getConsecutiveFailures()).toBe(1);

      engine.recordError(2, "bash", "command failed: exit 1", "running tests");
      expect(engine.getConsecutiveFailures()).toBe(2);
    });

    it("adds entry to error history", () => {
      engine.recordError(1, "bash", "command failed", "context");

      const history = engine.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].turn).toBe(1);
      expect(history[0].tool).toBe("bash");
      expect(history[0].error).toBe("command failed");
    });

    it("tracks stuck patterns", () => {
      engine.recordError(1, "bash", "ENOENT: no such file", "ctx");
      engine.recordError(2, "bash", "ENOENT: no such file", "ctx");

      const patterns = engine.getStuckPatterns();
      expect(patterns.get("FileNotFound")).toBe(2);
    });
  });

  describe("recordSuccess", () => {
    it("resets consecutive failures to 0", () => {
      engine.recordError(1, "bash", "err", "ctx");
      engine.recordError(2, "bash", "err", "ctx");
      expect(engine.getConsecutiveFailures()).toBe(2);

      engine.recordSuccess();
      expect(engine.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("needsReflection", () => {
    it("returns false below threshold", () => {
      engine.recordError(1, "bash", "error", "ctx");
      expect(engine.needsReflection(2)).toBe(false);
    });

    it("returns false when within reflection cooldown", async () => {
      engine.recordError(1, "bash", "TypeError: a", "ctx");
      engine.recordError(2, "bash", "TypeError: b", "ctx");
      await engine.reflect(3);

      engine.recordError(4, "bash", "TypeError: c", "ctx");
      engine.recordError(5, "bash", "TypeError: d", "ctx");

      expect(engine.needsReflection(5)).toBe(false);
      expect(engine.needsReflection(6)).toBe(true);
    });

    it("returns true when stuck pattern detected and cooldown passed", () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      expect(engine.needsReflection(5)).toBe(true);
    });

    it("returns false when no stuck pattern reaches threshold", () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "ReferenceError: y", "ctx");

      expect(engine.needsReflection(5)).toBe(false);
    });
  });

  describe("isRepeatingPattern", () => {
    it("detects repeated error patterns", () => {
      engine.recordError(1, "bash", "ENOENT: file not found", "ctx");
      engine.recordError(2, "bash", "ENOENT: file not found again", "ctx");

      expect(engine.isRepeatingPattern("ENOENT: file missing")).toBe(true);
    });

    it("returns false when errors are different", () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "ReferenceError: y", "ctx");

      expect(engine.isRepeatingPattern("SyntaxError: z")).toBe(false);
    });

    it("respects lookback parameter", () => {
      for (let i = 1; i <= 10; i++) {
        engine.recordError(i, "bash", `TypeError number ${i}`, "ctx");
      }
      engine.recordError(11, "bash", "ReferenceError: missing var", "ctx");

      expect(engine.isRepeatingPattern("ReferenceError: missing var", 3)).toBe(false);
    });
  });

  describe("reflect", () => {
    it("returns structured reflection from LLM", async () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      const reflection = await engine.reflect(5);

      expect(reflection.rootCause).toBe("Missing file");
      expect(reflection.diagnosis).toBe("File was not created before editing");
      expect(reflection.suggestedFix).toBe("Create the file first");
      expect(reflection.confidence).toBe(0.9);
    });

    it("resets consecutive failures after reflection", async () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      await engine.reflect(5);

      expect(engine.getConsecutiveFailures()).toBe(0);
    });

    it("adds reflection to reflections list", async () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      await engine.reflect(5);

      const reflections = engine.getReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].rootCause).toBe("Missing file");
    });

    it("returns fallback on LLM failure", async () => {
      const failingProvider: LLMProvider = {
        name: "openai-compatible" as const,
        complete: async () => {
          throw new Error("LLM unavailable");
        },
        stream: async () => ({ content: "", toolCalls: [], finishReason: "stop" }),
      };

      const eng = new ReflexionEngine(failingProvider, "gpt-4o");
      eng.recordError(1, "bash", "TypeError: x", "ctx");
      eng.recordError(2, "bash", "TypeError: y", "ctx");

      const reflection = await eng.reflect(5);

      expect(reflection.rootCause).toContain("Reflection generation failed");
      expect(reflection.confidence).toBe(0.3);
    });

    it("clears stuck patterns after reflection", async () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      await engine.reflect(5);

      expect(engine.getStuckPatterns().size).toBe(0);
    });

    it("updates last reflection turn", async () => {
      engine.recordError(1, "bash", "TypeError: x", "ctx");
      engine.recordError(2, "bash", "TypeError: y", "ctx");

      await engine.reflect(7);

      expect(engine.needsReflection(8)).toBe(false);
      expect(engine.needsReflection(10)).toBe(false);
    });
  });

  describe("formatReflectionPrompt", () => {
    it("includes diagnosis and suggested fix", () => {
      const reflection = {
        id: "refl-test",
        errorPattern: "TypeError",
        rootCause: "Missing initialization",
        diagnosis: "Variable used before assignment",
        suggestedFix: "Add initialization before use",
        confidence: 0.85,
        timestamp: Date.now(),
        relatedErrors: [],
      };

      const prompt = engine.formatReflectionPrompt(reflection);

      expect(prompt).toContain("Missing initialization");
      expect(prompt).toContain("Variable used before assignment");
      expect(prompt).toContain("Add initialization before use");
      expect(prompt).toContain("85%");
    });

    it("includes self-reflection header", () => {
      const reflection = {
        id: "refl-test",
        errorPattern: "TypeError",
        rootCause: "Root",
        diagnosis: "Diag",
        suggestedFix: "Fix",
        confidence: 0.5,
        timestamp: Date.now(),
        relatedErrors: [],
      };

      const prompt = engine.formatReflectionPrompt(reflection);

      expect(prompt).toContain("SELF-REFLECTION");
    });
  });

  describe("getReflections and getErrorHistory", () => {
    it("getReflections returns list of reflections", async () => {
      engine.recordError(1, "bash", "TypeError: a", "ctx");
      engine.recordError(2, "bash", "TypeError: b", "ctx");
      await engine.reflect(5);

      engine.recordError(6, "bash", "TypeError: c", "ctx");
      engine.recordError(7, "bash", "TypeError: d", "ctx");
      await engine.reflect(10);

      expect(engine.getReflections()).toHaveLength(2);
    });

    it("getErrorHistory returns error entries", () => {
      engine.recordError(1, "bash", "err1", "ctx1");
      engine.recordError(2, "read_file", "err2", "ctx2");
      engine.recordError(3, "bash", "err3", "ctx3");

      const history = engine.getErrorHistory();

      expect(history).toHaveLength(3);
      expect(history[0].tool).toBe("bash");
      expect(history[1].tool).toBe("read_file");
      expect(history[2].tool).toBe("bash");
    });

    it("returns empty arrays initially", () => {
      expect(engine.getReflections()).toEqual([]);
      expect(engine.getErrorHistory()).toEqual([]);
    });
  });
});
