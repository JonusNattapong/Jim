import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { autoRefreshGraphForFile, graph_query_handler, resetGraphState } from "./graph_query.js";

describe("graph_query", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `graph-query-test-${Date.now()}`);
    await mkdir(resolve(testDir, "src"), { recursive: true });
  });

  afterEach(async () => {
    resetGraphState();
    await rm(testDir, { recursive: true, force: true });
  });

  it("builds a knowledge graph and returns stats", async () => {
    await writeFile(resolve(testDir, "src", "base.ts"), "export class Base {}\n");
    await writeFile(
      resolve(testDir, "src", "service.ts"),
      "import { Base } from './base';\nexport class Service extends Base { run() { return 'ok'; } }\n",
    );

    const result = await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Knowledge graph built");
    expect(result.content).toContain("Nodes:");
    expect(result.content).toContain("Edges:");
  });

  it("queries entities by name", async () => {
    await writeFile(resolve(testDir, "src", "types.ts"), "export interface Config { port: number }\n");
    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });

    const result = await graph_query_handler({ action: "query", name: "Config" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Config");
    expect(result.content).toContain("interface");
  });

  it("finds dependency paths between entities", async () => {
    await writeFile(resolve(testDir, "src", "a.ts"), "export class A {}\n");
    await writeFile(resolve(testDir, "src", "b.ts"), "import { A } from './a';\nexport class B extends A {}\n");
    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });

    const result = await graph_query_handler({ action: "trace", name: "b.ts", target: "A" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Path found");
  });

  it("reports circular imports", async () => {
    await writeFile(resolve(testDir, "src", "a.ts"), "import { B } from './b';\nexport class A { b?: B }\n");
    await writeFile(resolve(testDir, "src", "b.ts"), "import { A } from './a';\nexport class B { a?: A }\n");
    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });

    const result = await graph_query_handler({ action: "cycles" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("circular");
  });

  it("loads graph from persisted cache when memory state is reset", async () => {
    await writeFile(resolve(testDir, "src", "service.ts"), "export class Service {}\n");

    const buildResult = await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });
    expect(buildResult.content).toContain("Cache:");

    resetGraphState();

    const result = await graph_query_handler({ action: "stats", dir: resolve(testDir, "src") });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Loaded from cache:");
  });

  it("auto-refreshes the graph after a file mutation", async () => {
    await writeFile(resolve(testDir, "src", "service.ts"), "export class Service {}\n");
    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });

    await writeFile(resolve(testDir, "src", "service.ts"), "export class Service { run() { return 'ok'; } }\n");
    const refreshNote = await autoRefreshGraphForFile(resolve(testDir, "src", "service.ts"), resolve(testDir, "src"));
    expect(refreshNote).toContain("Graph auto-refreshed");

    const result = await graph_query_handler({ action: "query", dir: resolve(testDir, "src"), name: "run", kinds: "method" });
    expect(result.content).toContain("run");
  });

  it("produces a bughunt report", async () => {
    await writeFile(resolve(testDir, "src", "a.ts"), "import { B } from './b';\nexport class A { one(){} two(){} three(){} four(){} five(){} six(){} }\n");
    await writeFile(resolve(testDir, "src", "b.ts"), "import { A } from './a';\nexport class B extends A {}\n");
    await writeFile(resolve(testDir, "src", "isolated.ts"), "export const lonely = 1;\n");
    await graph_query_handler({ action: "build", dir: resolve(testDir, "src") });

    const result = await graph_query_handler({ action: "bughunt", dir: resolve(testDir, "src"), max_results: 3 });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Bughunt Report");
    expect(result.content).toContain("Circular dependencies");
    expect(result.content).toContain("Isolated files");
  });
});
