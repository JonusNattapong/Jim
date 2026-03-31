import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HookEngine } from "./hooks.js";
import type { HookDefinition, HookResult } from "./hooks.js";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { platform } from "node:os";

const isWindows = platform() === "win32";

function echoCmd(text: string): string {
  return `echo ${text}`;
}

describe("HookEngine", () => {
  let engine: HookEngine;

  beforeEach(() => {
    engine = new HookEngine();
  });

  describe("add and list", () => {
    it("stores hook and list returns it", () => {
      const hook: HookDefinition = {
        event: "PreToolUse",
        toolPattern: "bash",
        command: echoCmd("hello"),
        description: "Test hook",
      };

      engine.add(hook);
      const hooks = engine.list();

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toEqual(hook);
    });

    it("list returns a copy not reference", () => {
      const hook: HookDefinition = {
        event: "SessionStart",
        command: echoCmd("start"),
      };

      engine.add(hook);
      const hooks1 = engine.list();
      const hooks2 = engine.list();

      expect(hooks1).not.toBe(hooks2);
      expect(hooks1).toEqual(hooks2);
    });

    it("mutating list result does not affect internal state", () => {
      engine.add({ event: "PreToolUse", command: echoCmd("a") });
      const hooks = engine.list();
      hooks.push({ event: "PostToolUse", command: echoCmd("b") });

      expect(engine.list()).toHaveLength(1);
    });
  });

  describe("fire", () => {
    it("returns { blocked: false } when no hooks match", async () => {
      engine.add({ event: "PreToolUse", command: echoCmd("hello") });

      const result = await engine.fire("SessionStart");

      expect(result).toEqual({ blocked: false, output: "" });
    });

    it("runs matching hook without blocking", async () => {
      engine.add({
        event: "SessionStart",
        command: echoCmd("hook-output"),
      });

      const result = await engine.fire("SessionStart");

      expect(result.blocked).toBe(false);
    });

    it("returns { blocked: true } when hook output contains __BLOCK__", async () => {
      engine.add({
        event: "PreToolUse",
        command: echoCmd("__BLOCK__ Dangerous command"),
      });

      const result = await engine.fire("PreToolUse");

      expect(result.blocked).toBe(true);
      expect(result.output).toContain("Dangerous command");
      expect(result.output).not.toContain("__BLOCK__");
    });

    it("passes context as environment variables", async () => {
      if (isWindows) {
        engine.add({
          event: "SessionStart",
          command: "echo %MY_VAR%",
        });
      } else {
        engine.add({
          event: "SessionStart",
          command: "echo $MY_VAR",
        });
      }

      const result = await engine.fire("SessionStart", { MY_VAR: "test-value" });

      expect(result.blocked).toBe(false);
    });

    it("handles non-fatal command errors gracefully", async () => {
      engine.add({
        event: "SessionStart",
        command: echoCmd("ok"),
      });

      const result = await engine.fire("SessionStart");

      expect(result.blocked).toBe(false);
    });
  });

  describe("fireForTool", () => {
    it("matches tool name against toolPattern", async () => {
      engine.add({
        event: "PreToolUse",
        toolPattern: "bash",
        command: echoCmd("__BLOCK__ blocked bash"),
      });

      const result = await engine.fireForTool("bash");

      expect(result.blocked).toBe(true);
      expect(result.output).toContain("blocked bash");
    });

    it("does not match when toolPattern does not match", async () => {
      engine.add({
        event: "PreToolUse",
        toolPattern: "bash",
        command: echoCmd("__BLOCK__ blocked"),
      });

      const result = await engine.fireForTool("read_file");

      expect(result.blocked).toBe(false);
    });

    it("matches all tools when no pattern set", async () => {
      engine.add({
        event: "PostToolUse",
        command: echoCmd("matched"),
      });

      const result = await engine.fireForTool("any_tool");

      expect(result.blocked).toBe(false);
    });

    it("only fires for PreToolUse and PostToolUse events", async () => {
      engine.add({
        event: "SessionStart",
        command: echoCmd("__BLOCK__ should not fire"),
      });

      const result = await engine.fireForTool("bash");

      expect(result.blocked).toBe(false);
    });

    it("supports regex patterns in toolPattern", async () => {
      engine.add({
        event: "PreToolUse",
        toolPattern: "bash|run_command",
        command: echoCmd("matched"),
      });

      const bash = await engine.fireForTool("bash");
      expect(bash.blocked).toBe(false);

      const runCmd = await engine.fireForTool("run_command");
      expect(runCmd.blocked).toBe(false);

      const other = await engine.fireForTool("read_file");
      expect(other.blocked).toBe(false);
    });
  });

  describe("loadFromFile", () => {
    const testHooksFile = resolve(".test-hooks.json");

    afterEach(async () => {
      try {
        await unlink(testHooksFile);
      } catch {
        // file may not exist
      }
    });

    it("loads hooks from a JSON file", async () => {
      const hooks: HookDefinition[] = [
        { event: "PreToolUse", toolPattern: "bash", command: echoCmd("loaded") },
        { event: "SessionEnd", command: echoCmd("end") },
      ];
      await writeFile(testHooksFile, JSON.stringify(hooks), "utf-8");

      await engine.loadFromFile(testHooksFile);

      expect(engine.list()).toHaveLength(2);
      expect(engine.list()[0].event).toBe("PreToolUse");
      expect(engine.list()[1].event).toBe("SessionEnd");
    });

    it("handles missing file gracefully", async () => {
      await engine.loadFromFile(".nonexistent-hooks-file.json");

      expect(engine.list()).toHaveLength(0);
    });

    it("adds loaded hooks to existing hooks", async () => {
      engine.add({ event: "SessionStart", command: echoCmd("existing") });

      const hooks: HookDefinition[] = [
        { event: "PreToolUse", command: echoCmd("loaded") },
      ];
      await writeFile(testHooksFile, JSON.stringify(hooks), "utf-8");

      await engine.loadFromFile(testHooksFile);

      expect(engine.list()).toHaveLength(2);
    });
  });
});
