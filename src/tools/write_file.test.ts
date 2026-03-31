import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

describe("write_file_handler", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jim-write-file-test-"));
  });

  afterEach(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("creates file with content and returns success message", async () => {
    const { write_file_handler } = await import("./write_file.js");
    const filePath = join(tempDir, "output.txt");

    const result = await write_file_handler({ path: filePath, content: "hello world\nsecond line" });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Successfully wrote");
    expect(result.content).toContain("lines");
    const disk = await readFile(filePath, "utf-8");
    expect(disk).toBe("hello world\nsecond line");
  });

  it("creates parent directories automatically", async () => {
    const { write_file_handler } = await import("./write_file.js");
    const filePath = join(tempDir, "a", "b", "c", "deep.txt");

    const result = await write_file_handler({ path: filePath, content: "deep content\n" });

    expect(result.isError).toBeFalsy();
    const disk = await readFile(filePath, "utf-8");
    expect(disk).toBe("deep content\n");
  });

  it("returns diff field with added lines", async () => {
    const { write_file_handler } = await import("./write_file.js");
    const filePath = join(tempDir, "diff-test.txt");

    const result = await write_file_handler({ path: filePath, content: "alpha\nbeta\n" });

    expect(result.diff).toBeDefined();
    expect(result.diff).toContain("+ alpha");
    expect(result.diff).toContain("+ beta");
  });

  it("overwrites existing file", async () => {
    const { write_file_handler } = await import("./write_file.js");
    const filePath = join(tempDir, "overwrite.txt");
    await readFile(filePath, "utf-8").catch(() => {});

    const r1 = await write_file_handler({ path: filePath, content: "original\n" });
    expect(r1.isError).toBeFalsy();

    const r2 = await write_file_handler({ path: filePath, content: "replaced\n" });
    expect(r2.isError).toBeFalsy();

    const disk = await readFile(filePath, "utf-8");
    expect(disk).toBe("replaced\n");
  });
});
