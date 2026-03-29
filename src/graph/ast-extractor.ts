/**
 * AST-based entity and relationship extractor.
 *
 * Uses ts-morph to parse TypeScript/JavaScript files and extract:
 * - Entities: files, classes, interfaces, functions, methods, types, enums, constants
 * - Relationships: imports, extends, implements, defines, calls, references
 *
 * Inspired by bloopAI/bloop's AST-driven code understanding approach.
 */

import { createHash } from "node:crypto";
import { Project, SyntaxKind, Node, type SourceFile, type ClassDeclaration, type InterfaceDeclaration, type FunctionDeclaration, type MethodDeclaration, type EnumDeclaration } from "ts-morph";
import { resolve, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { KnowledgeGraph } from "./knowledge-graph.js";
import type { GraphNode, GraphEdge, NodeKind, EdgeKind } from "./knowledge-graph.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "ast-extractor" });

// ─── Helpers ────────────────────────────────────────────────────────────────

let _project: Project | null = null;

function getProject(): Project {
  if (!_project) {
    _project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        skipLibCheck: true,
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 100, // Bundler
      },
    });
  }
  return _project;
}

export function resetProject(): void {
  _project = null;
}

function hashContent(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

function makeNodeId(file: string, kind: NodeKind, name: string): string {
  return `${file}::${kind}::${name}`;
}

function makeEdgeId(kind: EdgeKind, from: string, to: string): string {
  return `${kind}::${from}::${to}`;
}

function getJsDoc(node: Node): string | undefined {
  const jsDocs = node.getChildrenOfKind(SyntaxKind.JSDoc);
  if (jsDocs.length > 0) {
    return jsDocs[0].getComment()?.toString() ?? undefined;
  }
  return undefined;
}

function isExported(node: Node): boolean {
  try {
    const anyNode = node as any;
    if (typeof anyNode.isExported === "function") {
      return anyNode.isExported();
    }
  } catch { /* not exportable */ }
  // Check for export keyword in modifiers
  const modifiers = node.getChildren();
  return modifiers.some((m) => m.getKind() === SyntaxKind.ExportKeyword);
}

function resolveModulePath(sourceFile: SourceFile, moduleSpecifier: string): string | null {
  try {
    const resolved = sourceFile.getFilePath();
    const dir = resolved.substring(0, resolved.lastIndexOf("/"));
    if (moduleSpecifier.startsWith(".")) {
      // Relative import
      const resolvedPath = resolve(dir, moduleSpecifier);
      return resolvedPath;
    }
    return null; // External module
  } catch {
    return null;
  }
}

// ─── File Extraction ────────────────────────────────────────────────────────

export interface ExtractionResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors: string[];
}

/**
 * Extract entities and relationships from a single file.
 */
export async function extractFromFile(
  filePath: string,
  rootDir: string,
): Promise<ExtractionResult> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const errors: string[] = [];

  const relPath = relative(rootDir, filePath).replace(/\\/g, "/");
  const content = await readFile(filePath, "utf-8").catch(() => null);
  if (!content) {
    errors.push(`Cannot read file: ${filePath}`);
    return { nodes, edges, errors };
  }

  const project = getProject();
  let sourceFile: SourceFile;

  try {
    // Remove existing source file if present (for re-indexing)
    const existing = project.getSourceFile(filePath);
    if (existing) {
      existing.forget();
    }

    sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Parse error in ${relPath}: ${msg}`);
    return { nodes, edges, errors };
  }

  // ─── File Node ────────────────────────────────────────────────────────
  const fileNodeId = makeNodeId(relPath, "file", relPath);
  nodes.push({
    id: fileNodeId,
    kind: "file",
    name: relPath,
    file: relPath,
    line: 1,
    isExported: true,
    meta: { size: content.length, hash: hashContent(content) },
  });

  // ─── Imports ──────────────────────────────────────────────────────────
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const resolvedPath = resolveModulePath(sourceFile, moduleSpecifier);

    if (resolvedPath) {
      const targetRel = relative(rootDir, resolvedPath).replace(/\\/g, "/");
      const targetFileId = makeNodeId(targetRel, "file", targetRel);

      // Don't create file nodes for imports outside our scan
      edges.push({
        id: makeEdgeId("imports", fileNodeId, targetFileId),
        kind: "imports",
        from: fileNodeId,
        to: targetFileId,
        meta: {
          module: moduleSpecifier,
          names: importDecl.getNamedImports().map((n) => n.getName()),
          isDefault: importDecl.getDefaultImport() !== undefined,
          isNamespace: importDecl.getNamespaceImport() !== undefined,
        },
      });

      // Track depends_on for transitive dependency analysis
      edges.push({
        id: makeEdgeId("depends_on", fileNodeId, targetFileId),
        kind: "depends_on",
        from: fileNodeId,
        to: targetFileId,
        meta: { via: "import" },
      });
    }
  }

  // ─── Re-exports ───────────────────────────────────────────────────────
  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exportDecl.getModuleSpecifierValue();
    if (moduleSpecifier) {
      const resolvedPath = resolveModulePath(sourceFile, moduleSpecifier);
      if (resolvedPath) {
        const targetRel = relative(rootDir, resolvedPath).replace(/\\/g, "/");
        const targetFileId = makeNodeId(targetRel, "file", targetRel);
        edges.push({
          id: makeEdgeId("imports", fileNodeId, targetFileId),
          kind: "imports",
          from: fileNodeId,
          to: targetFileId,
          meta: { module: moduleSpecifier, isReExport: true },
        });
      }
    }
  }

  // ─── Classes ──────────────────────────────────────────────────────────
  for (const classDecl of sourceFile.getClasses()) {
    const name = classDecl.getName() ?? "<anonymous>";
    const classId = makeNodeId(relPath, "class", name);
    const extendsTypes = classDecl.getExtends()?.getText() ? [classDecl.getExtends()!.getText()] : [];
    const implTypes = classDecl.getImplements().map((i) => i.getText());

    nodes.push({
      id: classId,
      kind: "class",
      name,
      file: relPath,
      line: classDecl.getStartLineNumber(),
      signature: classDecl.getText().split("\n")[0].trim(),
      doc: getJsDoc(classDecl),
      extends: extendsTypes,
      implements: implTypes,
      isExported: isExported(classDecl),
      meta: { methodCount: classDecl.getMethods().length, propCount: classDecl.getProperties().length },
    });

    edges.push({
      id: makeEdgeId("defines", fileNodeId, classId),
      kind: "defines",
      from: fileNodeId,
      to: classId,
      meta: {},
    });

    edges.push({
      id: makeEdgeId("declared_in", classId, fileNodeId),
      kind: "declared_in",
      from: classId,
      to: fileNodeId,
      meta: {},
    });

    // Extends relationships
    for (const ext of extendsTypes) {
      const targetIds = resolveTypeToNodeIds(ext, relPath);
      for (const targetId of targetIds) {
        edges.push({
          id: makeEdgeId("extends", classId, targetId),
          kind: "extends",
          from: classId,
          to: targetId,
          meta: {},
        });
      }
    }

    // Implements relationships
    for (const impl of implTypes) {
      const targetIds = resolveTypeToNodeIds(impl, relPath);
      for (const targetId of targetIds) {
        edges.push({
          id: makeEdgeId("implements", classId, targetId),
          kind: "implements",
          from: classId,
          to: targetId,
          meta: {},
        });
      }
    }

    // Methods
    for (const method of classDecl.getMethods()) {
      const methodName = method.getName();
      const methodId = makeNodeId(relPath, "method", `${name}.${methodName}`);

      nodes.push({
        id: methodId,
        kind: "method",
        name: methodName,
        file: relPath,
        line: method.getStartLineNumber(),
        signature: method.getText().split("\n")[0].trim(),
        doc: getJsDoc(method),
        isExported: isExported(method) || method.getScope() === "public",
        meta: {
          parentClass: name,
          isStatic: method.isStatic(),
          isAsync: method.isAsync(),
          isAbstract: method.isAbstract(),
          visibility: method.getScope() ?? "public",
        },
      });

      edges.push({
        id: makeEdgeId("has_member", classId, methodId),
        kind: "has_member",
        from: classId,
        to: methodId,
        meta: {},
      });

      edges.push({
        id: makeEdgeId("declared_in", methodId, fileNodeId),
        kind: "declared_in",
        from: methodId,
        to: fileNodeId,
        meta: {},
      });
    }

    // Extract method call relationships within class
    extractCallsFromClass(classDecl, classId, relPath, edges);
  }

  // ─── Interfaces ───────────────────────────────────────────────────────
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    const ifaceId = makeNodeId(relPath, "interface", name);
    const extTypes = iface.getExtends().map((e) => e.getText());

    nodes.push({
      id: ifaceId,
      kind: "interface",
      name,
      file: relPath,
      line: iface.getStartLineNumber(),
      signature: iface.getText().split("\n")[0].trim(),
      doc: getJsDoc(iface),
      extends: extTypes,
      isExported: isExported(iface),
      meta: { methodCount: iface.getMethods().length, propCount: iface.getProperties().length },
    });

    edges.push({
      id: makeEdgeId("defines", fileNodeId, ifaceId),
      kind: "defines",
      from: fileNodeId,
      to: ifaceId,
      meta: {},
    });

    edges.push({
      id: makeEdgeId("declared_in", ifaceId, fileNodeId),
      kind: "declared_in",
      from: ifaceId,
      to: fileNodeId,
      meta: {},
    });

    // Extends
    for (const ext of extTypes) {
      const targetIds = resolveTypeToNodeIds(ext, relPath);
      for (const targetId of targetIds) {
        edges.push({
          id: makeEdgeId("extends", ifaceId, targetId),
          kind: "extends",
          from: ifaceId,
          to: targetId,
          meta: {},
        });
      }
    }
  }

  // ─── Functions ────────────────────────────────────────────────────────
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName() ?? "<anonymous>";
    const funcId = makeNodeId(relPath, "function", name);

    nodes.push({
      id: funcId,
      kind: "function",
      name,
      file: relPath,
      line: func.getStartLineNumber(),
      signature: func.getText().split("\n")[0].trim(),
      doc: getJsDoc(func),
      isExported: isExported(func),
      meta: { isAsync: func.isAsync(), paramCount: func.getParameters().length },
    });

    edges.push({
      id: makeEdgeId("defines", fileNodeId, funcId),
      kind: "defines",
      from: fileNodeId,
      to: funcId,
      meta: {},
    });

    edges.push({
      id: makeEdgeId("declared_in", funcId, fileNodeId),
      kind: "declared_in",
      from: funcId,
      to: fileNodeId,
      meta: {},
    });

    // Extract calls within function body
    extractCallsFromFunction(func, funcId, relPath, edges);
  }

  // ─── Type Aliases ─────────────────────────────────────────────────────
  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    const typeId = makeNodeId(relPath, "type", name);

    nodes.push({
      id: typeId,
      kind: "type",
      name,
      file: relPath,
      line: typeAlias.getStartLineNumber(),
      signature: typeAlias.getText().split("\n")[0].trim(),
      isExported: isExported(typeAlias),
      meta: {},
    });

    edges.push({
      id: makeEdgeId("defines", fileNodeId, typeId),
      kind: "defines",
      from: fileNodeId,
      to: typeId,
      meta: {},
    });

    edges.push({
      id: makeEdgeId("declared_in", typeId, fileNodeId),
      kind: "declared_in",
      from: typeId,
      to: fileNodeId,
      meta: {},
    });
  }

  // ─── Enums ────────────────────────────────────────────────────────────
  for (const enumDecl of sourceFile.getEnums()) {
    const name = enumDecl.getName();
    const enumId = makeNodeId(relPath, "enum", name);

    nodes.push({
      id: enumId,
      kind: "enum",
      name,
      file: relPath,
      line: enumDecl.getStartLineNumber(),
      signature: enumDecl.getText().split("\n")[0].trim(),
      isExported: isExported(enumDecl),
      meta: { members: enumDecl.getMembers().map((m) => m.getName()) },
    });

    edges.push({
      id: makeEdgeId("defines", fileNodeId, enumId),
      kind: "defines",
      from: fileNodeId,
      to: enumId,
      meta: {},
    });

    edges.push({
      id: makeEdgeId("declared_in", enumId, fileNodeId),
      kind: "declared_in",
      from: enumId,
      to: fileNodeId,
      meta: {},
    });
  }

  // ─── Exported Constants ───────────────────────────────────────────────
  for (const stmt of sourceFile.getVariableStatements()) {
    if (!isExported(stmt)) continue;
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      const constId = makeNodeId(relPath, "const", name);

      nodes.push({
        id: constId,
        kind: "const",
        name,
        file: relPath,
        line: decl.getStartLineNumber(),
        isExported: true,
        meta: { isConst: String(stmt.getDeclarationList().getDeclarationKind()) === "Const" },
      });

      edges.push({
        id: makeEdgeId("defines", fileNodeId, constId),
        kind: "defines",
        from: fileNodeId,
        to: constId,
        meta: {},
      });

      edges.push({
        id: makeEdgeId("declared_in", constId, fileNodeId),
        kind: "declared_in",
        from: constId,
        to: fileNodeId,
        meta: {},
      });
    }
  }

  return { nodes, edges, errors };
}

// ─── Call Extraction ────────────────────────────────────────────────────────

function extractCallsFromClass(
  classDecl: ClassDeclaration,
  classId: string,
  file: string,
  edges: GraphEdge[],
): void {
  for (const method of classDecl.getMethods()) {
    const methodName = method.getName();
    const methodId = makeNodeId(file, "method", `${classDecl.getName() ?? "?"}.${methodName}`);

    const callExprs = method.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExprs) {
      const expr = call.getExpression();
      let calleeName: string | null = null;

      if (Node.isIdentifier(expr)) {
        calleeName = expr.getText();
      } else if (Node.isPropertyAccessExpression(expr)) {
        calleeName = expr.getName();
      }

      if (calleeName) {
        const targetIds = resolveCallToNodeIds(calleeName, file);
        for (const targetId of targetIds) {
          edges.push({
            id: makeEdgeId("calls", methodId, targetId),
            kind: "calls",
            from: methodId,
            to: targetId,
            meta: { line: call.getStartLineNumber() },
          });
        }
      }
    }
  }
}

function extractCallsFromFunction(
  func: FunctionDeclaration,
  funcId: string,
  file: string,
  edges: GraphEdge[],
): void {
  const callExprs = func.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExprs) {
    const expr = call.getExpression();
    let calleeName: string | null = null;

    if (Node.isIdentifier(expr)) {
      calleeName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      calleeName = expr.getName();
    }

    if (calleeName) {
      const targetIds = resolveCallToNodeIds(calleeName, file);
      for (const targetId of targetIds) {
        edges.push({
          id: makeEdgeId("calls", funcId, targetId),
          kind: "calls",
          from: funcId,
          to: targetId,
          meta: { line: call.getStartLineNumber() },
        });
      }
    }
  }
}

/**
 * Resolve a type name to potential node IDs in the graph.
 * This is a best-effort heuristic since we don't have the full graph here.
 */
function resolveTypeToNodeIds(typeName: string, currentFile: string): string[] {
  // Clean up the type name
  const clean = typeName.replace(/[^a-zA-Z0-9_]/g, "");
  if (!clean) return [];

  // Return possible node IDs (will be resolved when building the full graph)
  return [
    makeNodeId(currentFile, "class", clean),
    makeNodeId(currentFile, "interface", clean),
    makeNodeId(currentFile, "type", clean),
  ];
}

/**
 * Resolve a function/method call name to potential node IDs.
 */
function resolveCallToNodeIds(callName: string, currentFile: string): string[] {
  return [
    makeNodeId(currentFile, "function", callName),
    makeNodeId(currentFile, "method", callName),
  ];
}

// ─── Batch Extraction ───────────────────────────────────────────────────────

export interface BatchExtractionResult {
  graph: KnowledgeGraph;
  filesProcessed: number;
  filesSkipped: number;
  errors: string[];
}

const SKIP_DIRS = ["node_modules", "dist", ".git", ".next", "build", "coverage", ".turbo", ".cache"];
const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_FILE_PATTERNS = [".d.ts", ".test.ts", ".spec.ts", ".test.tsx", ".spec.tsx", ".test.js", ".spec.js"];

/**
 * Scan a directory and build the full knowledge graph.
 */
export async function buildGraphFromDirectory(
  dirPath: string,
  maxFiles = 1000,
): Promise<BatchExtractionResult> {
  const graph = new KnowledgeGraph();
  const errors: string[] = [];
  let filesProcessed = 0;
  let filesSkipped = 0;

  const files = await discoverFiles(dirPath, maxFiles + 100);

  for (const filePath of files) {
    if (filesProcessed >= maxFiles) {
      filesSkipped++;
      continue;
    }

    try {
      const result = await extractFromFile(filePath, dirPath);

      for (const node of result.nodes) {
        graph.addNode(node);
      }
      for (const edge of result.edges) {
        // Avoid duplicate edges
        if (!graph.getEdge(edge.id)) {
          graph.addEdge(edge);
        }
      }
      errors.push(...result.errors);
      filesProcessed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error processing ${filePath}: ${msg}`);
      filesSkipped++;
    }

    if (filesProcessed % 50 === 0 && filesProcessed > 0) {
      log.info({ processed: filesProcessed, total: files.length }, "graph indexing progress");
    }
  }

  // Post-process: resolve cross-file references
  resolveCrossFileReferences(graph);

  log.info({ filesProcessed, filesSkipped, nodeCount: graph.getStats().nodeCount }, "graph built");

  return { graph, filesProcessed, filesSkipped, errors };
}

/**
 * Incrementally update the graph for a single changed file.
 */
export async function updateGraphForFile(
  graph: KnowledgeGraph,
  filePath: string,
  rootDir: string,
): Promise<{ added: number; removed: number }> {
  const relPath = relative(rootDir, filePath).replace(/\\/g, "/");

  // Remove old nodes/edges for this file
  const oldNodes = graph.getNodesByFile(relPath);
  graph.removeFile(relPath);

  // Re-extract
  const result = await extractFromFile(filePath, rootDir);

  for (const node of result.nodes) {
    graph.addNode(node);
  }
  for (const edge of result.edges) {
    if (!graph.getEdge(edge.id)) {
      graph.addEdge(edge);
    }
  }

  // Update file hash
  const content = await readFile(filePath, "utf-8").catch(() => "");
  graph.setFileHash(relPath, hashContent(content));

  resolveCrossFileReferences(graph);

  return { added: result.nodes.length, removed: oldNodes.length };
}

// ─── Cross-File Reference Resolution ────────────────────────────────────────

/**
 * After building the graph, resolve cross-file references.
 * For each reference edge, find the actual target node in the graph.
 */
function resolveCrossFileReferences(graph: KnowledgeGraph): void {
  // For each extends/implements edge, try to find the actual target
  for (const edge of graph["edges"].values()) {
    if (edge.kind !== "extends" && edge.kind !== "implements") continue;

    const sourceNode = graph.getNode(edge.from);
    if (!sourceNode) continue;

    // The 'to' field contains placeholder IDs; try to find actual nodes
    const targetNode = graph.getNode(edge.to);
    if (!targetNode) {
      // Try to find by name across all files
      const targetName = edge.to.split("::").pop() ?? "";
      const candidates = graph.getNodesByName(targetName);

      // Filter to only class/interface nodes
      const validCandidates = candidates.filter(
        (n) => n.kind === "class" || n.kind === "interface" || n.kind === "type"
      );

      if (validCandidates.length > 0) {
        // Update the edge to point to the first valid candidate
        edge.to = validCandidates[0].id;

        // Re-index the edge
        const outSet = graph["outEdges"].get(edge.from);
        const inSet = graph["inEdges"].get(edge.to);
        if (inSet) inSet.add(edge.id);
        else graph["inEdges"].set(edge.to, new Set([edge.id]));
      }
    }
  }
}

// ─── File Discovery ─────────────────────────────────────────────────────────

import { readdir, stat as fsStat } from "node:fs/promises";

async function discoverFiles(dirPath: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (files.length >= maxFiles || depth > 10) return;

    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = await readdir(currentDir, { withFileTypes: true }) as typeof entries;
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;

      const fullPath = currentDir + "/" + entry.name;

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          await walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = fullPath.substring(fullPath.lastIndexOf("."));
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
        if (SKIP_FILE_PATTERNS.some((p) => fullPath.endsWith(p))) continue;
        files.push(fullPath);
      }
    }
  }

  await walk(dirPath, 0);
  return files;
}
