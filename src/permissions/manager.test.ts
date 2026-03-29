import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PermissionManager } from "./manager.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

describe("PermissionManager", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = resolve(tmpdir(), `jim-test-${Date.now()}`);
    await mkdir(testRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  describe("mode: default", () => {
    it("allows safe tools without approval", async () => {
      const pm = new PermissionManager("default", testRoot);
      const result = await pm.check("read_file", { path: "test.ts" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("requires approval for write_file", async () => {
      const pm = new PermissionManager("default", testRoot);
      pm.setPlanApproved(true);
      const result = await pm.check("write_file", { path: "test.ts", content: "hello" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(true);
    });

    it("requires approval for run_command", async () => {
      const pm = new PermissionManager("default", testRoot);
      pm.setPlanApproved(true);
      const result = await pm.check("run_command", { command: "echo hi" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(true);
    });
  });

  describe("mode: plan", () => {
    it("allows read-only tools", async () => {
      const pm = new PermissionManager("plan", testRoot);
      const result = await pm.check("read_file", { path: "test.ts" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("blocks write tools", async () => {
      const pm = new PermissionManager("plan", testRoot);
      pm.setPlanApproved(true);
      const result = await pm.check("write_file", { path: "test.ts", content: "x" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Plan mode");
    });

    it("blocks run_command", async () => {
      const pm = new PermissionManager("plan", testRoot);
      const result = await pm.check("run_command", { command: "echo hi" });
      expect(result.allowed).toBe(false);
    });
  });

  describe("mode: dontAsk", () => {
    it("auto-approves everything", async () => {
      const pm = new PermissionManager("dontAsk", testRoot);
      const result = await pm.check("run_command", { command: "rm -rf /" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });
  });

  describe("mode: acceptEdits", () => {
    it("auto-approves edit tools", async () => {
      const pm = new PermissionManager("acceptEdits", testRoot);
      pm.setPlanApproved(true);
      const result = await pm.check("edit_file", { path: "test.ts", old_text: "a", new_text: "b" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("requires approval for run_command", async () => {
      const pm = new PermissionManager("acceptEdits", testRoot);
      pm.setPlanApproved(true);
      const result = await pm.check("run_command", { command: "echo hi" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(true);
    });
  });

  describe("allow/deny patterns", () => {
    it("blocks via deny pattern", async () => {
      const pm = new PermissionManager("dontAsk", testRoot);
      pm.addDenyPattern("rm -rf");
      const result = await pm.check("run_command", { command: "rm -rf /tmp" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("deny rule");
    });

    it("auto-approves via allow pattern", async () => {
      const pm = new PermissionManager("default", testRoot);
      pm.addAllowPattern("read_file");
      const result = await pm.check("read_file", { path: "any.ts" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("deny takes precedence over allow", async () => {
      const pm = new PermissionManager("default", testRoot);
      pm.setPlanApproved(true);
      pm.addAllowPattern("run_command");
      pm.addDenyPattern("sudo");
      const result = await pm.check("run_command", { command: "sudo rm -rf /" });
      expect(result.allowed).toBe(false);
    });
  });

  describe("persistence", () => {
    it("saves and loads decisions", async () => {
      const pm1 = new PermissionManager("default", testRoot);
      pm1.setPlanApproved(true);
      await pm1.saveDecision("run_command", { command: "echo hi" }, true);
      
      const pm2 = new PermissionManager("default", testRoot);
      pm2.setPlanApproved(true);
      await pm2.loadPersisted();

      const result = await pm2.check("run_command", { command: "echo hi" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("persists deny decisions", async () => {
      const pm1 = new PermissionManager("default", testRoot);
      pm1.setPlanApproved(true);
      await pm1.saveDecision("run_command", { command: "rm -rf /" }, false);

      const pm2 = new PermissionManager("default", testRoot);
      pm2.setPlanApproved(true);
      await pm2.loadPersisted();

      const result = await pm2.check("run_command", { command: "rm -rf /" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Previously denied");
    });

    it("handles missing persistence file gracefully", async () => {
      const pm = new PermissionManager("default", testRoot);
      await expect(pm.loadPersisted()).resolves.not.toThrow();
    });

    it("saves to .jim/permissions.json under projectRoot", async () => {
      const pm = new PermissionManager("default", testRoot);
      await pm.saveDecision("test_tool", { x: 1 }, true);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(join(testRoot, ".jim", "permissions.json"), "utf-8");
      const entries = JSON.parse(content);
      expect(entries).toHaveLength(1);
      expect(entries[0].toolName).toBe("test_tool");
      expect(entries[0].approved).toBe(true);
    });

    it("saveDecision approves all calls to that tool", async () => {
      const pm1 = new PermissionManager("default", testRoot);
      pm1.setPlanApproved(true);
      await pm1.saveDecision("run_command", { command: "echo hi" }, true);

      const pm2 = new PermissionManager("default", testRoot);
      pm2.setPlanApproved(true);
      await pm2.loadPersisted();

      // Different args should still match (wildcard)
      const result = await pm2.check("run_command", { command: "echo hello world" });
      expect(result.allowed).toBe(true);
      expect(result.needsApproval).toBe(false);
    });

    it("savePattern allows specific wildcard patterns", async () => {
      const pm1 = new PermissionManager("default", testRoot);
      pm1.setPlanApproved(true);
      await pm1.savePattern("run_command:command=echo*", true);

      const pm2 = new PermissionManager("default", testRoot);
      pm2.setPlanApproved(true);
      await pm2.loadPersisted();

      // echo commands approved
      const r1 = await pm2.check("run_command", { command: "echo hi" });
      expect(r1.allowed).toBe(true);

      // Other commands still need approval
      const r2 = await pm2.check("run_command", { command: "rm -rf /" });
      expect(r2.needsApproval).toBe(true);
    });
  });

  describe("mode switching", () => {
    it("setMode changes behavior", async () => {
      const pm = new PermissionManager("default", testRoot);
      pm.setPlanApproved(true);
      expect((await pm.check("write_file", { path: "x" })).needsApproval).toBe(true);

      pm.setMode("dontAsk");
      expect((await pm.check("write_file", { path: "x" })).needsApproval).toBe(false);

      pm.setMode("plan");
      expect((await pm.check("write_file", { path: "x" })).allowed).toBe(false);
    });

    it("getMode returns current mode", () => {
      const pm = new PermissionManager("acceptEdits", testRoot);
      expect(pm.getMode()).toBe("acceptEdits");
    });
  });
});
