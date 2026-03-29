/**
 * Codebase Knowledge Graph — GraphRAG for code.
 *
 * Inspired by microsoft/graphrag (entity + relationship extraction into
 * a queryable graph) and bloopAI/bloop (AST-driven code understanding).
 *
 * Design principles:
 * - Nodes represent code entities (files, classes, interfaces, functions, etc.)
 * - Edges represent typed relationships (imports, extends, implements, calls, defines)
 * - In-memory graph with fast traversal and pattern matching
 * - Incremental updates: only re-analyze changed files
 * - Persistable to disk for session continuity
 */

// ─── Node Types ─────────────────────────────────────────────────────────────

export type NodeKind =
  | "file"
  | "class"
  | "interface"
  | "function"
  | "method"
  | "type"
  | "enum"
  | "const"
  | "variable"
  | "parameter";

export type EdgeKind =
  | "imports"        // file -> module
  | "defines"        // file/class -> entity
  | "extends"        // class/interface -> parent
  | "implements"     // class -> interface
  | "references"     // any -> any (identifier usage)
  | "calls"          // function/method -> function/method
  | "returns"        // function -> type
  | "has_member"     // class/interface -> method/property
  | "depends_on"     // file -> file (transitive import)
  | "declared_in";   // entity -> file

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  /** File path where this node is defined */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Optional signature (for functions/methods/types) */
  signature?: string;
  /** Optional doc comment */
  doc?: string;
  /** For classes: extends */
  extends?: string[];
  /** For classes: implements */
  implements?: string[];
  /** Is exported from the file */
  isExported: boolean;
  /** Generic metadata */
  meta: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  /** Source node id */
  from: string;
  /** Target node id */
  to: string;
  /** Optional metadata (e.g. call arguments count, import alias) */
  meta: Record<string, unknown>;
}

// ─── Graph Store ────────────────────────────────────────────────────────────

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
  classCount: number;
  interfaceCount: number;
  functionCount: number;
  methodCount: number;
  edgeKinds: Record<string, number>;
}

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();

  // Adjacency lists for fast traversal
  private outEdges = new Map<string, Set<string>>();   // nodeId -> edgeIds
  private inEdges = new Map<string, Set<string>>();    // nodeId -> edgeIds

  // Indexes for fast lookup
  private nodesByKind = new Map<NodeKind, Set<string>>();
  private nodesByFile = new Map<string, Set<string>>();
  private edgesByKind = new Map<EdgeKind, Set<string>>();
  private nodesByName = new Map<string, Set<string>>();

  // File hash tracking for incremental updates
  private fileHashes = new Map<string, string>();

  // ─── Node Operations ───────────────────────────────────────────────────

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);

    // Index by kind
    if (!this.nodesByKind.has(node.kind)) this.nodesByKind.set(node.kind, new Set());
    this.nodesByKind.get(node.kind)!.add(node.id);

    // Index by file
    if (!this.nodesByFile.has(node.file)) this.nodesByFile.set(node.file, new Set());
    this.nodesByFile.get(node.file)!.add(node.id);

    // Index by name (lowercase for case-insensitive lookup)
    const nameKey = node.name.toLowerCase();
    if (!this.nodesByName.has(nameKey)) this.nodesByName.set(nameKey, new Set());
    this.nodesByName.get(nameKey)!.add(node.id);

    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, new Set());
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, new Set());
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByKind(kind: NodeKind): GraphNode[] {
    const ids = this.nodesByKind.get(kind);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  getNodesByFile(file: string): GraphNode[] {
    const ids = this.nodesByFile.get(file);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  getNodesByName(name: string): GraphNode[] {
    const ids = this.nodesByName.get(name.toLowerCase());
    if (!ids) return [];
    return Array.from(ids).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  searchNodes(query: string, kinds?: NodeKind[]): GraphNode[] {
    const q = query.toLowerCase();
    const results: GraphNode[] = [];

    for (const node of this.nodes.values()) {
      if (kinds && !kinds.includes(node.kind)) continue;
      if (node.name.toLowerCase().includes(q) ||
          node.signature?.toLowerCase().includes(q) ||
          node.file.toLowerCase().includes(q)) {
        results.push(node);
      }
    }

    return results;
  }

  // ─── Edge Operations ───────────────────────────────────────────────────

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);

    if (!this.outEdges.has(edge.from)) this.outEdges.set(edge.from, new Set());
    this.outEdges.get(edge.from)!.add(edge.id);

    if (!this.inEdges.has(edge.to)) this.inEdges.set(edge.to, new Set());
    this.inEdges.get(edge.to)!.add(edge.id);

    if (!this.edgesByKind.has(edge.kind)) this.edgesByKind.set(edge.kind, new Set());
    this.edgesByKind.get(edge.kind)!.add(edge.id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  /** Get all edges going OUT from a node (optionally filtered by kind) */
  getOutEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.outEdges.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id)!)
      .filter((e) => e && (!kind || e.kind === kind));
  }

  /** Get all edges coming IN to a node (optionally filtered by kind) */
  getInEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.inEdges.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id)!)
      .filter((e) => e && (!kind || e.kind === kind));
  }

  /** Get all neighbor node IDs (via outgoing edges, optionally filtered) */
  getNeighbors(nodeId: string, kind?: EdgeKind): GraphNode[] {
    const edges = this.getOutEdges(nodeId, kind);
    return edges.map((e) => this.nodes.get(e.to)!).filter(Boolean);
  }

  /** Get all neighbor node IDs (via incoming edges, optionally filtered) */
  getIncomingNeighbors(nodeId: string, kind?: EdgeKind): GraphNode[] {
    const edges = this.getInEdges(nodeId, kind);
    return edges.map((e) => this.nodes.get(e.from)!).filter(Boolean);
  }

  // ─── Graph Traversal ───────────────────────────────────────────────────

  /**
   * BFS traversal from a start node, following edges of given kinds.
   * Returns all reachable nodes within maxDepth hops.
   */
  traverse(startId: string, edgeKinds?: EdgeKind[], maxDepth = 5): GraphNode[] {
    const visited = new Set<string>();
    const result: GraphNode[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node && id !== startId) result.push(node);

      if (depth < maxDepth) {
        const edges = this.getOutEdges(id);
        for (const edge of edges) {
          if (!edgeKinds || edgeKinds.includes(edge.kind)) {
            if (!visited.has(edge.to)) {
              queue.push({ id: edge.to, depth: depth + 1 });
            }
          }
        }
        // Also follow inbound edges for certain relationship types
        const inEdges = this.getInEdges(id);
        for (const edge of inEdges) {
          if (edgeKinds && (edgeKinds.includes("references") || edgeKinds.includes("calls"))) {
            if (!visited.has(edge.from)) {
              queue.push({ id: edge.from, depth: depth + 1 });
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Find the shortest path between two nodes.
   * Returns the path as an array of node IDs, or null if no path exists.
   */
  findPath(fromId: string, toId: string, maxDepth = 10): string[] | null {
    if (fromId === toId) return [fromId];

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (visited.has(id) || path.length > maxDepth) continue;
      visited.add(id);

      // Check all outgoing edges
      for (const edge of this.getOutEdges(id)) {
        if (edge.to === toId) return [...path, toId];
        if (!visited.has(edge.to)) {
          queue.push({ id: edge.to, path: [...path, edge.to] });
        }
      }
      // Check all incoming edges (for reverse traversal)
      for (const edge of this.getInEdges(id)) {
        if (edge.from === toId) return [...path, toId];
        if (!visited.has(edge.from)) {
          queue.push({ id: edge.from, path: [...path, edge.from] });
        }
      }
    }

    return null;
  }

  /**
   * Find all nodes that are connected to a given node through any path.
   * Returns a subgraph of related nodes.
   */
  findRelated(nodeId: string, maxDepth = 3): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const visited = new Set<string>();
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      if (id !== nodeId) nodeSet.add(id);

      if (depth < maxDepth) {
        for (const edge of this.getOutEdges(id)) {
          edgeSet.add(edge.id);
          if (!visited.has(edge.to)) {
            queue.push({ id: edge.to, depth: depth + 1 });
          }
        }
        for (const edge of this.getInEdges(id)) {
          edgeSet.add(edge.id);
          if (!visited.has(edge.from)) {
            queue.push({ id: edge.from, depth: depth + 1 });
          }
        }
      }
    }

    return {
      nodes: Array.from(nodeSet).map((id) => this.nodes.get(id)!).filter(Boolean),
      edges: Array.from(edgeSet).map((id) => this.edges.get(id)!).filter(Boolean),
    };
  }

  // ─── Impact Analysis ───────────────────────────────────────────────────

  /**
   * Find all entities that would be affected if a given entity changes.
   * This is the "blast radius" analysis.
   */
  findImpact(nodeId: string): GraphNode[] {
    const impacted = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (impacted.has(current)) continue;
      impacted.add(current);

      // Find all nodes that reference or call this node
      for (const edge of this.getInEdges(current)) {
        if (["references", "calls", "extends", "implements", "imports"].includes(edge.kind)) {
          if (!impacted.has(edge.from)) {
            queue.push(edge.from);
          }
        }
      }

      // If it's a file, find all files that depend on it
      const node = this.nodes.get(current);
      if (node?.kind === "file") {
        for (const edge of this.getInEdges(current)) {
          if (edge.kind === "depends_on" || edge.kind === "imports") {
            if (!impacted.has(edge.from)) {
              queue.push(edge.from);
            }
          }
        }
      }
    }

    impacted.delete(nodeId); // Don't include the original node
    return Array.from(impacted).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  // ─── Circular Dependency Detection ─────────────────────────────────────

  /**
   * Detect circular dependencies in the graph.
   * Returns all cycles found as arrays of node IDs.
   */
  findCycles(edgeKind: EdgeKind = "imports"): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);

      for (const edge of this.getOutEdges(nodeId, edgeKind)) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path, edge.to]);
        } else if (recStack.has(edge.to)) {
          const cycleStart = path.indexOf(edge.to);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      recStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, [nodeId]);
      }
    }

    return cycles;
  }

  // ─── File Operations ───────────────────────────────────────────────────

  /** Remove all nodes and edges for a file (for incremental re-indexing) */
  removeFile(file: string): void {
    const nodeIds = this.nodesByFile.get(file);
    if (!nodeIds) return;

    for (const nodeId of nodeIds) {
      // Remove edges connected to this node
      const outEdgeIds = this.outEdges.get(nodeId) ?? new Set();
      const inEdgeIds = this.inEdges.get(nodeId) ?? new Set();

      for (const edgeId of [...outEdgeIds, ...inEdgeIds]) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          // Remove from other node's adjacency lists
          this.outEdges.get(edge.from)?.delete(edgeId);
          this.inEdges.get(edge.to)?.delete(edgeId);
          // Remove from kind index
          this.edgesByKind.get(edge.kind)?.delete(edgeId);
        }
        this.edges.delete(edgeId);
      }

      // Remove from indexes
      const node = this.nodes.get(nodeId);
      if (node) {
        this.nodesByKind.get(node.kind)?.delete(nodeId);
        this.nodesByName.get(node.name.toLowerCase())?.delete(nodeId);
      }
      this.outEdges.delete(nodeId);
      this.inEdges.delete(nodeId);
      this.nodes.delete(nodeId);
    }

    this.nodesByFile.delete(file);
    this.fileHashes.delete(file);
  }

  /** Check if a file needs re-indexing based on content hash */
  needsReindex(file: string, hash: string): boolean {
    return this.fileHashes.get(file) !== hash;
  }

  setFileHash(file: string, hash: string): void {
    this.fileHashes.set(file, hash);
  }

  getIndexedFiles(): string[] {
    return Array.from(this.nodesByFile.keys());
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  getStats(): GraphStats {
    const edgeKinds: Record<string, number> = {};
    for (const [kind, ids] of this.edgesByKind) {
      edgeKinds[kind] = ids.size;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      fileCount: this.nodesByFile.size,
      classCount: this.nodesByKind.get("class")?.size ?? 0,
      interfaceCount: this.nodesByKind.get("interface")?.size ?? 0,
      functionCount: this.nodesByKind.get("function")?.size ?? 0,
      methodCount: this.nodesByKind.get("method")?.size ?? 0,
      edgeKinds,
    };
  }

  /** Clear the entire graph */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outEdges.clear();
    this.inEdges.clear();
    this.nodesByKind.clear();
    this.nodesByFile.clear();
    this.edgesByKind.clear();
    this.nodesByName.clear();
    this.fileHashes.clear();
  }

  // ─── Serialization ─────────────────────────────────────────────────────

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[]; fileHashes: Record<string, string> } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      fileHashes: Object.fromEntries(this.fileHashes),
    };
  }

  static fromJSON(data: { nodes: GraphNode[]; edges: GraphEdge[]; fileHashes?: Record<string, string> }): KnowledgeGraph {
    const graph = new KnowledgeGraph();
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }
    if (data.fileHashes) {
      for (const [file, hash] of Object.entries(data.fileHashes)) {
        graph.fileHashes.set(file, hash);
      }
    }
    return graph;
  }
}
