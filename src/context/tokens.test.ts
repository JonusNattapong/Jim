import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TokenCounter, getTokenCounter } from "./tokens.js";

describe("TokenCounter", () => {
  let counter: TokenCounter;

  beforeEach(() => {
    counter = new TokenCounter();
  });

  afterEach(() => {
    counter.free();
  });

  describe("count()", () => {
    it("returns positive number for non-empty string", () => {
      const result = counter.count("Hello, world!");
      expect(result).toBeGreaterThan(0);
    });

    it("returns 0 for empty string", () => {
      const result = counter.count("");
      expect(result).toBe(0);
    });
  });

  describe("countMessages()", () => {
    it("adds 4 overhead tokens per message plus 2 reply priming", () => {
      const messages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ];
      const result = counter.countMessages(messages);
      const contentTokens = counter.count("Hi") + counter.count("Hello");
      expect(result).toBe(4 + 4 + contentTokens + 2);
    });

    it("handles array content format", () => {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        },
      ];
      const result = counter.countMessages(messages);
      const contentTokens = counter.count("First part") + counter.count("Second part");
      expect(result).toBe(4 + contentTokens + 2);
    });
  });

  describe("remainingTokens()", () => {
    it("returns 0 when over budget", () => {
      const result = counter.remainingTokens(200_000, 200_000, 4096);
      expect(result).toBe(0);
    });

    it("returns correct remaining", () => {
      const result = counter.remainingTokens(10_000, 200_000, 4096);
      expect(result).toBe(200_000 - 10_000 - 4096);
    });
  });

  describe("shouldCompact()", () => {
    it("returns true above 85% threshold", () => {
      const result = counter.shouldCompact(171_000, 200_000);
      expect(result).toBe(true);
    });

    it("returns false below threshold", () => {
      const result = counter.shouldCompact(100_000, 200_000);
      expect(result).toBe(false);
    });
  });

  describe("truncate()", () => {
    it("returns original when under limit", () => {
      const text = "Short text";
      const result = counter.truncate(text, 1000);
      expect(result).toBe(text);
    });

    it("truncates and adds suffix when over limit", () => {
      const text = "word ".repeat(500).trim();
      const result = counter.truncate(text, 10);
      expect(result.length).toBeLessThan(text.length);
      expect(result).toContain("(truncated)");
    });
  });

  describe("estimateCost()", () => {
    it("returns correct cost for known model", () => {
      const cost = counter.estimateCost(1_000_000, 1_000_000, "gpt-4o");
      expect(cost).toBeCloseTo(2.50 + 10, 5);
    });

    it("returns default cost for unknown model", () => {
      const cost = counter.estimateCost(1_000_000, 1_000_000, "unknown-model-xyz");
      expect(cost).toBeCloseTo(2 + 8, 5);
    });
  });
});

describe("getTokenCounter()", () => {
  it("returns singleton", () => {
    const a = getTokenCounter();
    const b = getTokenCounter();
    expect(a).toBe(b);
  });
});
