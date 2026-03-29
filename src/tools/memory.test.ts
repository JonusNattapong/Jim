import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

describe("ArchivalMemoryStore", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jim-memory-test-"));
    process.env.JIM_MEMORY_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.JIM_MEMORY_DIR;
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  async function freshStore() {
    const { ArchivalMemoryStore } = await import("../context/memory-store.js");
    return new ArchivalMemoryStore(tempDir);
  }

  it("archives and recalls entries", async () => {
    const store = await freshStore();

    const entry = await store.archive("The API uses Express.js with TypeScript", {
      tags: ["architecture", "api"],
      source: "test",
    });

    expect(entry.id).toMatch(/^mem-/);
    expect(entry.content).toBe("The API uses Express.js with TypeScript");
    expect(entry.tags).toEqual(["architecture", "api"]);

    const results = await store.search("Express TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.content).toContain("Express.js");
  });

  it("returns empty for no matches", async () => {
    const store = await freshStore();

    await store.archive("Some content about databases", { tags: ["db"] });

    const results = await store.search("quantum physics", 5);
    expect(results).toHaveLength(0);
  });

  it("lists entries", async () => {
    const store = await freshStore();

    await store.archive("Entry one", { tags: ["test"] });
    await store.archive("Entry two", { tags: ["test"] });

    const entries = await store.list(10);
    expect(entries).toHaveLength(2);
  });

  it("deletes entries", async () => {
    const store = await freshStore();

    const entry = await store.archive("To be deleted", { tags: ["temp"] });
    expect(await store.count()).toBe(1);

    const deleted = await store.deleteEntry(entry.id);
    expect(deleted).toBe(true);
    expect(await store.count()).toBe(0);
  });

  it("filters by tags", async () => {
    const store = await freshStore();

    await store.archive("Architecture decision about middleware", { tags: ["architecture"] });
    await store.archive("Bug fix in auth module", { tags: ["bugfix"] });

    const archResults = await store.search("middleware", 5, ["architecture"]);
    expect(archResults).toHaveLength(1);
    expect(archResults[0].entry.tags).toContain("architecture");

    const bugResults = await store.search("middleware", 5, ["bugfix"]);
    expect(bugResults).toHaveLength(0);
  });

  it("archives conversations in batch", async () => {
    const store = await freshStore();

    const messages = [
      { role: "user", content: "How do I set up the database?" },
      { role: "assistant", content: "You can use Prisma ORM with PostgreSQL for this project." },
      { role: "tool", content: "Database connected successfully." },
    ];

    const archived = await store.archiveConversation(messages, "test-session", 0);
    expect(archived).toBe(3);
    expect(await store.count()).toBe(3);
  });

  it("clears all entries", async () => {
    const store = await freshStore();

    await store.archive("Entry 1", { tags: ["test"] });
    await store.archive("Entry 2", { tags: ["test"] });
    expect(await store.count()).toBe(2);

    const cleared = await store.clear();
    expect(cleared).toBe(2);
    expect(await store.count()).toBe(0);
  });
});

describe("memory tools", { sequential: true }, () => {
  let toolTempDir: string;

  beforeEach(async () => {
    toolTempDir = await mkdtemp(join(tmpdir(), "jim-memory-tool-test-"));
    process.env.JIM_MEMORY_DIR = toolTempDir;
    const { resetArchivalMemoryStore } = await import("../context/memory-store.js");
    resetArchivalMemoryStore();
  });

  afterEach(async () => {
    delete process.env.JIM_MEMORY_DIR;
    try { await rm(toolTempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("memory_archive handler archives content", async () => {
    const { memory_archive_handler } = await import("../tools/memory.js");
    const result = await memory_archive_handler({
      content: "The build command is `pnpm build`",
      tags: "commands,build",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Archived memory entry");
  });

  it("memory_recall handler finds archived content", async () => {
    const { memory_archive_handler, memory_recall_handler } = await import("../tools/memory.js");

    await memory_archive_handler({
      content: "We use PostgreSQL with Prisma ORM for the database layer",
      tags: "database,architecture",
    });

    const result = await memory_recall_handler({ query: "PostgreSQL database" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("PostgreSQL");
  });

  it("memory_recall returns no-match message for empty store", async () => {
    const { memory_recall_handler } = await import("../tools/memory.js");
    const result = await memory_recall_handler({ query: "nonexistent topic xyz" });
    expect(result.content).toContain("No memories found");
  });

  it("memory_list handler shows entries", async () => {
    const { memory_archive_handler, memory_list_handler } = await import("../tools/memory.js");

    await memory_archive_handler({ content: "Test entry for listing" });
    const result = await memory_list_handler({});
    expect(result.content).toContain("Memory Store");
  });

  it("memory_forget handler deletes entry", async () => {
    const { memory_archive_handler, memory_forget_handler } = await import("../tools/memory.js");

    const archiveResult = await memory_archive_handler({ content: "Temporary note for deletion" });
    const match = archiveResult.content.match(/mem-[a-z0-9-]+/i);
    expect(match).toBeTruthy();

    const deleteResult = await memory_forget_handler({ id: match![0] });
    expect(deleteResult.content).toContain("Deleted");
  });
});
