import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

// We test the handler directly
import { get_repo_map_handler } from "./get_repo_map.js";
import { graph_query_handler, resetGraphState } from "./graph_query.js";

describe("get_repo_map", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `repo-map-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    resetGraphState();
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns empty message for directory with no exports", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "noexports.ts"), "const x = 1;\nconsole.log(x);");

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("No exported structures");
  });

  it("extracts exported classes with methods", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "myclass.ts"), `
export class MyClass {
  name: string;
  constructor(name: string) { this.name = name; }
  greet(): string { return "hello " + this.name; }
  static create(name: string): MyClass { return new MyClass(name); }
}
`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("MyClass");
    expect(result.content).toContain("myclass.ts");
  });

  it("extracts exported interfaces", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "types.ts"), `
export interface Config {
  name: string;
  port: number;
  debug?: boolean;
}
`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("interface Config");
  });

  it("extracts exported functions", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "utils.ts"), `
export function add(a: number, b: number): number {
  return a + b;
}
export const multiply = (a: number, b: number): number => a * b;
`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("add");
    expect(result.content).toContain("multiply");
  });

  it("extracts type aliases", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "types.ts"), `
export type ID = string | number;
export type Callback = (err: Error | null, data: unknown) => void;
`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("type ID");
  });

  it("includes imports when requested", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "main.ts"), `
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function main() {
  console.log("hello");
}
`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src"), includeImports: true });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("imports:");
    expect(result.content).toContain("readFile");
  });

  it("skips test files", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "myclass.ts"), `export class MyClass {}`);
    await writeFile(resolve(testDir, "src", "myclass.test.ts"), `export class MyTest {}`);
    await writeFile(resolve(testDir, "src", "myclass.spec.ts"), `export class MySpec {}`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.content).toContain("MyClass");
    expect(result.content).not.toContain("MyTest");
    expect(result.content).not.toContain("MySpec");
  });

  it("skips .d.ts files", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "real.ts"), `export class Real {}`);
    await writeFile(resolve(testDir, "src", "types.d.ts"), `export class Fake {}`);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.content).toContain("Real");
    expect(result.content).not.toContain("Fake");
  });

  it("handles nonexistent directory gracefully", async () => {
    const result = await get_repo_map_handler({ dir: resolve(testDir, "nonexistent") });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("does not exist");
  });

  it("respects max output size", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    // Create a file with many exports
    const exports = Array.from({ length: 500 }, (_, i) => `export const var${i} = ${i};`).join("\n");
    await writeFile(resolve(testDir, "src", "big.ts"), exports);

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    // Should not exceed 50000 chars
    expect(result.content!.length).toBeLessThanOrEqual(50010);
  });

  it("includes GraphRAG summary when a graph cache exists", async () => {
    await mkdir(resolve(testDir, "src"), { recursive: true });
    await writeFile(resolve(testDir, "src", "base.ts"), `export class Base {}`);
    await writeFile(resolve(testDir, "src", "child.ts"), `import { Base } from "./base"; export class Child extends Base {}`);

    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });
    resetGraphState();

    const result = await get_repo_map_handler({ dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("GraphRAG Summary");
    expect(result.content).toContain("Most connected files:");
  });
});
