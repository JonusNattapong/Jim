import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { KnowledgeGraph } from "./knowledge-graph.js";

interface GraphCachePayload {
  version: 1;
  rootDir: string;
  savedAt: string;
  graph: ReturnType<KnowledgeGraph["toJSON"]>;
}

function getCachePath(rootDir: string): string {
  return join(resolve(rootDir), ".jim", "code-graph.json");
}

export async function saveGraphCache(rootDir: string, graph: KnowledgeGraph): Promise<string> {
  const cachePath = getCachePath(rootDir);
  await mkdir(join(resolve(rootDir), ".jim"), { recursive: true });
  const payload: GraphCachePayload = {
    version: 1,
    rootDir: resolve(rootDir),
    savedAt: new Date().toISOString(),
    graph: graph.toJSON(),
  };
  await writeFile(cachePath, JSON.stringify(payload), "utf-8");
  return cachePath;
}

export async function loadGraphCache(rootDir: string): Promise<{ graph: KnowledgeGraph; savedAt: string; cachePath: string } | null> {
  const cachePath = getCachePath(rootDir);
  try {
    const raw = await readFile(cachePath, "utf-8");
    const payload = JSON.parse(raw) as GraphCachePayload;
    if (payload.version !== 1) return null;
    return {
      graph: KnowledgeGraph.fromJSON(payload.graph),
      savedAt: payload.savedAt,
      cachePath,
    };
  } catch {
    return null;
  }
}

export async function hasGraphCache(rootDir: string): Promise<boolean> {
  return (await loadGraphCache(rootDir)) !== null;
}
