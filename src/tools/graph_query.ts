/**
 * Graph Query Tool — lets the agent query the codebase knowledge graph.
 *
 * Actions:
 * - build: Build/rebuild the knowledge graph from a directory
 * - query: Search for entities by name/type
 * - trace: Find the relationship path between two entities
 * - impact: Find what would break if an entity changes
 * - deps: Show dependencies of a file/entity
 * - cycles: Find circular dependencies
 * - stats: Show graph statistics
 * - related: Find all related entities for a node
 */

import type { ToolDefinition, ToolHandler, ToolResult } from "./types.js";
import { resolve, relative } from "node:path";
import { KnowledgeGraph } from "../graph/knowledge-graph.js";
import { buildGraphFromDirectory, updateGraphForFile, resetProject } from "../graph/ast-extractor.js";
import { loadGraphCache, saveGraphCache } from "../graph/cache.js";
import type { NodeKind } from "../graph/knowledge-graph.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "graph-query-tool" });

// Singleton graph instance
let graphInstance: KnowledgeGraph | null = null;
let graphRootDir: string | null = null;

export function getGraphInstance(): KnowledgeGraph | null {
  return graphInstance;
}

export function getGraphRootDir(): string | null {
  return graphRootDir;
}

export function resetGraphState(): void {
  graphInstance = null;
  graphRootDir = null;
}

export async function autoRefreshGraphForFile(filePath: string, projectRoot: string): Promise<string | null> {
  await ensureGraphLoaded(projectRoot);
  if (!graphInstance) {
    return null;
  }

  const rootDir = graphRootDir ?? projectRoot;
  const absFile = resolve(filePath);
  const relFile = relative(resolve(rootDir), absFile).replace(/\\/g, "/");

  if (relFile.startsWith("..")) {
    return null;
  }

  const result = await updateGraphForFile(graphInstance, absFile, rootDir);
  await saveGraphCache(rootDir, graphInstance);
  return `Graph auto-refreshed for ${relFile}: -${result.removed} +${result.added} nodes`;
}

async function ensureGraphLoaded(preferredRoot?: string): Promise<{ loadedFromCache: boolean; savedAt?: string }> {
  if (graphInstance) {
    return { loadedFromCache: false };
  }

  const rootDir = preferredRoot ?? process.cwd();
  const cached = await loadGraphCache(rootDir);
  if (!cached) {
    return { loadedFromCache: false };
  }

  graphInstance = cached.graph;
  graphRootDir = rootDir;
  log.info({ rootDir, cachePath: cached.cachePath }, "knowledge graph loaded from cache");
  return { loadedFromCache: true, savedAt: cached.savedAt };
}

export const graph_query_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "graph_query",
    description:
      "Query the codebase knowledge graph for structural analysis. " +
      "Unlike simple text search, this graph captures relationships between code entities: " +
      "imports, class hierarchies, function calls, type dependencies, and more. " +
      "Use this to find cross-file bugs, understand dependency chains, analyze impact of changes, " +
      "or discover architectural patterns.\n\n" +
      "Actions:\n" +
      "- 'build': Build/rebuild graph from a directory (run this first)\n" +
      "- 'query': Search entities by name or type (class, interface, function, etc.)\n" +
      "- 'trace': Find relationship path between two entities\n" +
      "- 'impact': Find what would break if entity X changes\n" +
      "- 'deps': Show dependencies of a file or entity\n" +
      "- 'cycles': Find circular dependencies\n" +
      "- 'stats': Show graph statistics\n" +
      "- 'related': Find all related entities for a node\n" +
      "- 'refresh': Re-index a single changed file\n" +
      "- 'bughunt': Find suspicious hotspots, dependency risks, and likely bug zones",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["build", "query", "trace", "impact", "deps", "cycles", "stats", "related", "refresh", "bughunt"],
          description: "The graph operation to perform.",
        },
        dir: {
          type: "string",
          description: "Directory to build graph from (for 'build' action). Default: project root.",
        },
        name: {
          type: "string",
          description: "Entity name to search or analyze (for query/trace/impact/deps/related actions).",
        },
        file: {
          type: "string",
          description: "File path to refresh (for 'refresh' action) or analyze deps.",
        },
        target: {
          type: "string",
          description: "Target entity name (for 'trace' action — find path from 'name' to 'target').",
        },
        kinds: {
          type: "string",
          description: "Comma-separated node types to filter: file,class,interface,function,method,type,enum,const",
        },
        max_results: {
          type: "number",
          description: "Max results to return (default: 20).",
        },
        max_files: {
          type: "number",
          description: "Max files to index (for 'build', default: 500).",
        },
      },
      required: ["action"],
    },
  },
};

export const graph_query_handler: ToolHandler = async (args): Promise<ToolResult> => {
  const action = args.action as string;

  switch (action) {
    case "build": {
      const dir = (args.dir as string) ?? process.cwd();
      const maxFiles = (args.max_files as number) ?? 500;

      resetProject();
      const startTime = Date.now();
      const result = await buildGraphFromDirectory(dir, maxFiles);
      const elapsed = Date.now() - startTime;

      graphInstance = result.graph;
      graphRootDir = dir;
      const cachePath = await saveGraphCache(dir, result.graph);

      const stats = result.graph.getStats();
      const errorSummary = result.errors.length > 0
        ? `\n\nErrors (${result.errors.length}):\n${result.errors.slice(0, 10).join("\n")}${result.errors.length > 10 ? `\n... and ${result.errors.length - 10} more` : ""}`
        : "";

      return {
        content:
          `Knowledge graph built in ${elapsed}ms\n` +
          `Files processed: ${result.filesProcessed}, skipped: ${result.filesSkipped}\n` +
          `Nodes: ${stats.nodeCount} (files: ${stats.fileCount}, classes: ${stats.classCount}, interfaces: ${stats.interfaceCount}, functions: ${stats.functionCount}, methods: ${stats.methodCount})\n` +
          `Edges: ${stats.edgeCount}\n` +
          `Edge types: ${JSON.stringify(stats.edgeKinds)}\n` +
          `Cache: ${cachePath}${errorSummary}`,
      };
    }

    case "query": {
      const load = await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const name = args.name as string;
      if (!name) return { content: "Error: 'name' is required for query", isError: true };

      const kindFilter = args.kinds
        ? (args.kinds as string).split(",").map((k) => k.trim() as NodeKind)
        : undefined;

      const maxResults = (args.max_results as number) ?? 20;
      const results = graphInstance.searchNodes(name, kindFilter).slice(0, maxResults);

      if (results.length === 0) {
        return { content: `No entities found matching '${name}'${kindFilter ? ` of type ${kindFilter.join(",")}` : ""}` };
      }

      const lines = results.map((n) => {
        const meta: string[] = [];
        if (n.extends?.length) meta.push(`extends ${n.extends.join(", ")}`);
        if (n.implements?.length) meta.push(`implements ${n.implements.join(", ")}`);
        if (!n.isExported) meta.push("private");

        const inDegree = graphInstance!.getInEdges(n.id).length;
        const outDegree = graphInstance!.getOutEdges(n.id).length;

        return `- **${n.name}** (${n.kind}) @ ${n.file}:${n.line}\n` +
          `  ${n.signature ?? ""}\n` +
          `  refs: ${inDegree} in / ${outDegree} out${meta.length ? ` | ${meta.join(", ")}` : ""}`;
      });

      const cacheNote = load.loadedFromCache ? `\nLoaded graph cache from ${load.savedAt}.\n` : "";
      return { content: `${cacheNote}Found ${results.length} entity(ies) matching '${name}':\n\n${lines.join("\n\n")}` };
    }

    case "trace": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const fromName = args.name as string;
      const toName = args.target as string;
      if (!fromName || !toName) return { content: "Error: 'name' and 'target' are required for trace", isError: true };

      const fromNodes = graphInstance.searchNodes(fromName).slice(0, 5);
      const toNodes = graphInstance.searchNodes(toName).slice(0, 5);

      if (fromNodes.length === 0) return { content: `No entity found matching '${fromName}'` };
      if (toNodes.length === 0) return { content: `No entity found matching '${toName}'` };

      // Try to find path between any pair
      for (const from of fromNodes) {
        for (const to of toNodes) {
          const path = graphInstance.findPath(from.id, to.id);
          if (path) {
            const pathNodes = path.map((id) => graphInstance!.getNode(id)!).filter(Boolean);
            const pathStr = pathNodes.map((n) => `${n.name} (${n.kind}@${n.file})`).join(" → ");
            return { content: `Path found (${path.length - 1} hops):\n\n${pathStr}` };
          }
        }
      }

      return { content: `No path found between '${fromName}' and '${toName}' within 10 hops` };
    }

    case "impact": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const name = args.name as string;
      if (!name) return { content: "Error: 'name' is required for impact", isError: true };

      const nodes = graphInstance.searchNodes(name).slice(0, 5);
      if (nodes.length === 0) return { content: `No entity found matching '${name}'` };

      const results: string[] = [];
      for (const node of nodes.slice(0, 3)) {
        const impacted = graphInstance.findImpact(node.id);
        if (impacted.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const imp of impacted) {
            if (!grouped[imp.kind]) grouped[imp.kind] = [];
            grouped[imp.kind].push(`${imp.name} (${imp.file})`);
          }

          const summary = Object.entries(grouped)
            .map(([kind, items]) => `  ${kind}: ${items.slice(0, 5).join(", ")}${items.length > 5 ? ` +${items.length - 5} more` : ""}`)
            .join("\n");

          results.push(`**${node.name}** (${node.kind} @ ${node.file}:${node.line}):\n  Blast radius: ${impacted.length} entities\n${summary}`);
        } else {
          results.push(`**${node.name}**: No impact (nothing depends on this entity)`);
        }
      }

      return { content: `Impact analysis for '${name}':\n\n${results.join("\n\n")}` };
    }

    case "deps": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const file = args.file as string;
      const name = args.name as string;

      if (file) {
        // File-level deps
        const fileNodes = graphInstance.getNodesByFile(file);
        const imports = graphInstance.getNodesByFile(file)
          .flatMap((n) => graphInstance!.getOutEdges(n.id, "imports"))
          .map((e) => graphInstance!.getNode(e.to))
          .filter(Boolean)
          .map((n) => `${n!.name} (${n!.kind})`);

        const importedBy = graphInstance.getIncomingNeighbors(
          graphInstance.getNodesByFile(file).find((n) => n.kind === "file")?.id ?? "",
          "imports",
        ).map((n) => n.name);

        return {
          content:
            `Dependencies for ${file}:\n\n` +
            `Imports (${imports.length}):\n${imports.map((i) => `  - ${i}`).join("\n")}\n\n` +
            `Imported by (${importedBy.length}):\n${importedBy.map((i) => `  - ${i}`).join("\n")}\n\n` +
            `Entities: ${fileNodes.map((n) => `${n.name} (${n.kind})`).join(", ")}`,
        };
      }

      if (name) {
        const nodes = graphInstance.searchNodes(name).slice(0, 3);
        if (nodes.length === 0) return { content: `No entity found matching '${name}'` };

        const results = nodes.map((node) => {
          const outgoing = graphInstance!.getOutEdges(node.id)
            .map((e) => `  ${e.kind} → ${graphInstance!.getNode(e.to)?.name ?? e.to}`)
            .slice(0, 10);
          const incoming = graphInstance!.getInEdges(node.id)
            .map((e) => `  ${e.kind} ← ${graphInstance!.getNode(e.from)?.name ?? e.from}`)
            .slice(0, 10);

          return `**${node.name}** (${node.kind} @ ${node.file}):\n` +
            `Outgoing:\n${outgoing.join("\n") || "  (none)"}\n` +
            `Incoming:\n${incoming.join("\n") || "  (none)"}`;
        });

        return { content: results.join("\n\n") };
      }

      return { content: "Error: provide 'file' or 'name' for deps", isError: true };
    }

    case "cycles": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const cycles = graphInstance.findCycles("imports");
      if (cycles.length === 0) {
        return { content: "No circular dependencies found!" };
      }

      const cycleStrs = cycles.slice(0, 10).map((cycle, i) => {
        const names = cycle.map((id) => graphInstance!.getNode(id)?.name ?? id);
        return `${i + 1}. ${names.join(" → ")} → ${names[0]}`;
      });

      return {
        content: `Found ${cycles.length} circular dependencies:\n\n${cycleStrs.join("\n")}` +
          (cycles.length > 10 ? `\n... and ${cycles.length - 10} more` : ""),
      };
    }

    case "stats": {
      const load = await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const stats = graphInstance.getStats();
      const files = graphInstance.getIndexedFiles();

      return {
        content:
          `Knowledge Graph Statistics:\n\n` +
          `Total nodes: ${stats.nodeCount}\n` +
          `  Files: ${stats.fileCount}\n` +
          `  Classes: ${stats.classCount}\n` +
          `  Interfaces: ${stats.interfaceCount}\n` +
          `  Functions: ${stats.functionCount}\n` +
          `  Methods: ${stats.methodCount}\n` +
          `Total edges: ${stats.edgeCount}\n` +
          `Edge breakdown: ${JSON.stringify(stats.edgeKinds, null, 2)}\n\n` +
          `${load.loadedFromCache ? `Loaded from cache: ${load.savedAt}\n\n` : ""}` +
          `Indexed files (${files.length}):\n${files.slice(0, 20).map((f) => `  - ${f}`).join("\n")}` +
          (files.length > 20 ? `\n  ... and ${files.length - 20} more` : ""),
      };
    }

    case "related": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const name = args.name as string;
      if (!name) return { content: "Error: 'name' is required for related", isError: true };

      const nodes = graphInstance.searchNodes(name).slice(0, 3);
      if (nodes.length === 0) return { content: `No entity found matching '${name}'` };

      const results = nodes.map((node) => {
        const { nodes: relatedNodes, edges: relatedEdges } = graphInstance!.findRelated(node.id, 2);

        const byKind: Record<string, string[]> = {};
        for (const rel of relatedNodes) {
          if (!byKind[rel.kind]) byKind[rel.kind] = [];
          byKind[rel.kind].push(`${rel.name} (${rel.file})`);
        }

        const summary = Object.entries(byKind)
          .map(([kind, items]) => `  ${kind}: ${items.slice(0, 8).join(", ")}${items.length > 8 ? ` +${items.length - 8} more` : ""}`)
          .join("\n");

        return `**${node.name}** (${node.kind} @ ${node.file}:${node.line}):\n` +
          `Related entities: ${relatedNodes.length}, edges: ${relatedEdges.length}\n${summary}`;
      });

      return { content: `Related entities for '${name}':\n\n${results.join("\n\n")}` };
    }

    case "refresh": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const file = args.file as string;
      if (!file) return { content: "Error: 'file' is required for refresh", isError: true };

      const rootDir = graphRootDir ?? process.cwd();
      const result = await updateGraphForFile(graphInstance, file, rootDir);
      const cachePath = await saveGraphCache(rootDir, graphInstance);

      return {
        content: `Refreshed ${file}: removed ${result.removed} old nodes, added ${result.added} new nodes.\n` +
          `Graph now has ${graphInstance.getStats().nodeCount} nodes.\n` +
          `Cache: ${cachePath}`,
      };
    }

    case "bughunt": {
      await ensureGraphLoaded((args.dir as string) ?? process.cwd());
      if (!graphInstance) return { content: "Error: Graph not built. Run 'build' first.", isError: true };

      const maxResults = (args.max_results as number) ?? 5;
      const cycles = graphInstance.findCycles("imports").slice(0, maxResults);
      const fileNodes = graphInstance.getNodesByKind("file");
      const classNodes = graphInstance.getNodesByKind("class");

      const hotspots = fileNodes
        .map((node) => ({
          node,
          inbound: graphInstance!.getInEdges(node.id, "imports").length,
          outbound: graphInstance!.getOutEdges(node.id, "imports").length,
          impact: graphInstance!.findImpact(node.id).length,
        }))
        .sort((a, b) => (b.impact + b.inbound + b.outbound) - (a.impact + a.inbound + a.outbound))
        .slice(0, maxResults);

      const godClasses = classNodes
        .map((node) => ({
          node,
          members: graphInstance!.getOutEdges(node.id, "has_member").length,
          impact: graphInstance!.findImpact(node.id).length,
        }))
        .filter((entry) => entry.members >= 5 || entry.impact >= 3)
        .sort((a, b) => (b.members + b.impact) - (a.members + a.impact))
        .slice(0, maxResults);

      const isolatedFiles = fileNodes
        .filter((node) => graphInstance!.getInEdges(node.id, "imports").length === 0 && graphInstance!.getOutEdges(node.id, "imports").length === 0)
        .slice(0, maxResults);

      const lines: string[] = ["Bughunt Report", ""];

      lines.push("Hotspots:");
      if (hotspots.length === 0) {
        lines.push("  - none");
      } else {
        for (const hot of hotspots) {
          lines.push(`  - ${hot.node.name}: impact=${hot.impact}, imports_in=${hot.inbound}, imports_out=${hot.outbound}`);
        }
      }

      lines.push("", "Large / risky classes:");
      if (godClasses.length === 0) {
        lines.push("  - none");
      } else {
        for (const item of godClasses) {
          lines.push(`  - ${item.node.name} (${item.node.file}): members=${item.members}, impact=${item.impact}`);
        }
      }

      lines.push("", "Circular dependencies:");
      if (cycles.length === 0) {
        lines.push("  - none");
      } else {
        for (const cycle of cycles) {
          const names = cycle.map((id) => graphInstance!.getNode(id)?.name ?? id);
          lines.push(`  - ${names.join(" -> ")} -> ${names[0]}`);
        }
      }

      lines.push("", "Isolated files:");
      if (isolatedFiles.length === 0) {
        lines.push("  - none");
      } else {
        for (const node of isolatedFiles) {
          lines.push(`  - ${node.name}`);
        }
      }

      lines.push("", "Heuristic notes:");
      lines.push("  - High-impact hotspots are good bug-fix entry points and regression-test targets.");
      lines.push("  - Circular imports often correlate with init-order bugs and brittle architecture.");
      lines.push("  - Large classes with wide blast radius are likely refactor candidates.");

      return { content: lines.join("\n") };
    }

    default:
      return { content: `Unknown action: ${action}. Use: build, query, trace, impact, deps, cycles, stats, related, refresh, bughunt`, isError: true };
  }
};
