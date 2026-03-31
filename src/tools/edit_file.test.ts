import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

describe("edit_file_handler", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jim-edit-file-test-"));
  });

  afterEach(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("replaces lines in a file successfully", async () => {
    const { edit_file_handler } = await import("./edit_file.js");
    const filePath = join(tempDir, "edit.txt");
    await writeFile(filePath, "line1\nline2\nline3\nline4\n", "utf-8");

    const result = await edit_file_handler({
      path: filePath,
      start_line: 2,
      end_line: 3,
      new_text: "replaced_line2\nreplaced_line3",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Successfully replaced lines 2-3");
    const disk = await readFile(filePath, "utf-8");
    expect(disk).toBe("line1\nreplaced_line2\nreplaced_line3\nline4\n");
  });

  it("returns diff with old and new lines", async () => {
    const { edit_file_handler } = await import("./edit_file.js");
    const filePath = join(tempDir, "diff.txt");
    await writeFile(filePath, "old\n", "utf-8");

    const result = await edit_file_handler({
      path: filePath,
      start_line: 1,
      end_line: 1,
      new_text: "new",
    });

    expect(result.diff).toBeDefined();
    expect(result.diff).toContain("- old");
    expect(result.diff).toContain("+ new");
  });

  it("returns error for out-of-bounds start_line", async () => {
    const { edit_file_handler } = await import("./edit_file.js");
    const filePath = join(tempDir, "bounds.txt");
    await writeFile(filePath, "one\ntwo\n", "utf-8");

    const result = await edit_file_handler({
      path: filePath,
      start_line: 10,
      end_line: 10,
      new_text: "nope",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("out of bounds");
  });

  it("returns error when end_line < start_line", async () => {
    const { edit_file_handler } = await import("./edit_file.js");
    const filePath = join(tempDir, "invalid.txt");
    await writeFile(filePath, "one\ntwo\nthree\n", "utf-8");

    const result = await edit_file_handler({
      path: filePath,
      start_line: 3,
      end_line: 1,
      new_text: "nope",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("must be >= start_line");
  });

  it("returns error for non-existent file", async () => {
    const { edit_file_handler } = await import("./edit_file.js");
    const filePath = join(tempDir, "missing.txt");

    const result = await edit_file_handler({
      path: filePath,
      start_line: 1,
      end_line: 1,
      new_text: "nope",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("Error editing file");
  });
});
