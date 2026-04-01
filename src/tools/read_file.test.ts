import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TEST_FILE_DIR = "src/tools/__test_fixtures__";

describe("read_file_handler", () => {
  beforeEach(async () => {
    try {
      await rm(TEST_FILE_DIR, { recursive: true, force: true });
    } catch { /* ok */ }
    await import("node:fs/promises").then(fs => fs.mkdir(TEST_FILE_DIR, { recursive: true }));
  });

  afterEach(async () => {
    try { await rm(TEST_FILE_DIR, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("reads entire file and returns line-numbered content", async () => {
    const { read_file_handler } = await import("./read_file.js");
    const filePath = join(TEST_FILE_DIR, "example.txt");
    await writeFile(filePath, "line one\nline two\nline three", "utf-8");

    const result = await read_file_handler({ path: filePath });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("lines");
    expect(result.content).toContain("    1→line one");
    expect(result.content).toContain("    2→line two");
    expect(result.content).toContain("    3→line three");
  });

  it("reads specific line range with start_line and end_line", async () => {
    const { read_file_handler } = await import("./read_file.js");
    const filePath = join(TEST_FILE_DIR, "range.txt");
    await writeFile(filePath, "first\nsecond\nthird\nfourth\nfifth\n", "utf-8");

    const result = await read_file_handler({ path: filePath, start_line: 2, end_line: 4 });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("lines 2-4");
    expect(result.content).toContain("    2→second");
    expect(result.content).toContain("    4→fourth");
    expect(result.content).not.toContain("first");
    expect(result.content).not.toContain("fifth");
  });

  it("returns error for non-existent file", async () => {
    const { read_file_handler } = await import("./read_file.js");
    const filePath = join("src", "does_not_exist.txt");

    const result = await read_file_handler({ path: filePath });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("File or directory not found");
  });

  it("handles empty file", async () => {
    const { read_file_handler } = await import("./read_file.js");
    const filePath = join(TEST_FILE_DIR, "empty.txt");
    await writeFile(filePath, "", "utf-8");

    const result = await read_file_handler({ path: filePath });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("lines");
  });
});
