import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager, type SessionData, type CheckpointData } from "./sessions.js";

describe("SessionManager", () => {
  let tempDir: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jim-test-"));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempDir;
    delete process.env.USERPROFILE;
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    if (originalUserProfile !== undefined) {
      process.env.USERPROFILE = originalUserProfile;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
      id: manager.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      model: "gpt-4o",
      projectRoot: tempDir,
      turnCount: 0,
      ...overrides,
    };
  }

  describe("generateId()", () => {
    it("returns unique session IDs", () => {
      const id1 = manager.generateId();
      const id2 = manager.generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session-/);
    });
  });

  describe("save() and load()", () => {
    it("round-trips session data", async () => {
      const session = makeSession({ turnCount: 5, model: "gpt-4o" });
      await manager.save(session);
      const loaded = await manager.load(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(session.id);
      expect(loaded!.turnCount).toBe(5);
      expect(loaded!.model).toBe("gpt-4o");
    });

    it("load() returns null for non-existent session", async () => {
      const loaded = await manager.load("non-existent-id");
      expect(loaded).toBeNull();
    });
  });

  describe("list()", () => {
    it("returns sessions sorted by creation", async () => {
      const s1 = makeSession({ createdAt: "2025-01-01T00:00:00.000Z" });
      const s2 = makeSession({ createdAt: "2025-06-01T00:00:00.000Z" });
      await manager.save(s1);
      await manager.save(s2);
      const list = await manager.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("prioritizes sessions from the current project when requested", async () => {
      const otherProject = join(tempDir, "other");
      const same = makeSession({ id: "same-project", updatedAt: "2025-01-01T00:00:00.000Z", projectRoot: tempDir });
      const other = makeSession({ id: "other-project", updatedAt: "2026-01-01T00:00:00.000Z", projectRoot: otherProject });
      await manager.save(other);
      await manager.save(same);

      const list = await manager.list(tempDir);
      expect(list[0]?.id).toBe("same-project");
      expect(list[0]?.sameProject).toBe(true);
    });

    it("includes latest message preview in summaries", async () => {
      const session = makeSession({
        id: "preview-session",
        messages: [
          { role: "user", content: "first prompt" } as any,
          { role: "assistant", content: "latest reply" } as any,
        ],
      });
      await manager.save(session);

      const list = await manager.list(tempDir);
      expect(list.find((entry) => entry.id === "preview-session")?.lastMessage).toBe("latest reply");
    });

    it("captures message role and compact snippet", async () => {
      const session = makeSession({
        id: "snippet-session",
        messages: [
          { role: "assistant", content: "line one\nline two with more detail" } as any,
        ],
      });
      await manager.save(session);

      const summary = (await manager.list(tempDir)).find((entry) => entry.id === "snippet-session");
      expect(summary?.lastMessageRole).toBe("assistant");
      expect(summary?.lastMessageSnippet).toBe("line one line two with more detail");
    });
  });

  describe("delete()", () => {
    it("removes session file", async () => {
      const session = makeSession();
      await manager.save(session);
      const deleted = await manager.delete(session.id);
      expect(deleted).toBe(true);
      const loaded = await manager.load(session.id);
      expect(loaded).toBeNull();
    });
  });

  describe("createCheckpoint()", () => {
    it("creates a checkpoint for existing session", async () => {
      const session = makeSession({ turnCount: 3 });
      session.messages = [{ role: "user", content: "hello" }] as any;
      await manager.save(session);
      const cp = await manager.createCheckpoint(session.id, "test checkpoint");
      expect(cp).not.toBeNull();
      expect(cp!.sessionId).toBe(session.id);
      expect(cp!.label).toBe("test checkpoint");
      expect(cp!.turnCount).toBe(3);
      expect(cp!.messageCount).toBe(1);
    });

    it("returns null for non-existing session", async () => {
      const cp = await manager.createCheckpoint("no-such-session", "label");
      expect(cp).toBeNull();
    });
  });

  describe("listCheckpoints()", () => {
    it("returns checkpoints for a session", async () => {
      const session = makeSession();
      await manager.save(session);
      await manager.createCheckpoint(session.id, "cp1");
      await manager.createCheckpoint(session.id, "cp2");
      const cps = await manager.listCheckpoints(session.id);
      expect(cps.length).toBe(2);
      expect(cps[0].label).toBe("cp1");
      expect(cps[1].label).toBe("cp2");
    });
  });

  describe("restoreCheckpoint()", () => {
    it("overwrites session with checkpoint data", async () => {
      const session = makeSession({ turnCount: 1 });
      session.messages = [{ role: "user", content: "original" }] as any;
      await manager.save(session);

      const cp = await manager.createCheckpoint(session.id, "before change");
      expect(cp).not.toBeNull();

      session.turnCount = 10;
      session.messages = [{ role: "user", content: "modified" }] as any;
      await manager.save(session);

      const restored = await manager.restoreCheckpoint(session.id, cp!.id);
      expect(restored).not.toBeNull();
      expect(restored!.turnCount).toBe(1);
      expect((restored!.messages[0] as any).content).toBe("original");

      const loaded = await manager.load(session.id);
      expect(loaded!.turnCount).toBe(1);
    });
  });
});
