import { readdir, readFile, stat as fsStat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { getGraphInstance, getGraphRootDir } from "./graph_query.js";
import { loadGraphCache } from "../graph/cache.js";
import type { KnowledgeGraph } from "../graph/knowledge-graph.js";

export const get_repo_map_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "get_repo_map",
    description:
      "Get a semantic structural map of the repository using AST analysis. " +
      "Shows classes with method signatures, interfaces, types, exported functions, " +
      "and import relationships. Uses token-budget-aware ranking to fit the most " +
      "relevant symbols within the requested budget. " +
      "Use this when starting a complex task to understand the codebase architecture " +
      "without reading all files.",
    parameters: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Directory to scan (default: ./src)",
        },
        maxDepth: {
          type: "number",
          description: "Max directory depth to scan (default: 5)",
        },
        includeImports: {
          type: "boolean",
          description: "Show import relationships (default: false)",
        },
        showDependencies: {
          type: "boolean",
          description: "Show cross-file dependency graph (who imports whom) (default: false)",
        },
        maxTokens: {
          type: "number",
          description: "Maximum tokens for the output map (default: 2000). Uses binary search to fit ranked symbols within budget.",
        },
        focusFiles: {
          type: "string",
          description: "Comma-separated file paths to prioritize in ranking (e.g. 'src/agent/loop.ts,src/tools/registry.ts')",
        },
      },
      required: [],
    },
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolInfo {
  kind: "class" | "interface" | "type" | "function" | "const" | "enum";
  name: string;
  signature: string;
  isExported: boolean;
  methods?: Array<{ name: string; signature: string; isStatic: boolean }>;
  properties?: Array<{ name: string; type: string }>;
  extends?: string[];
  implements?: string[];
}

interface FileMap {
  path: string;
  symbols: SymbolInfo[];
  imports: Array<{ module: string; names: string[] }>;
  exports: string[];
}

interface RankedSymbol {
  fileMap: FileMap;
  symbol: SymbolInfo;
  score: number;
}

interface ReferenceGraph {
  /** file -> set of identifiers it references */
  fileRefs: Map<string, Set<string>>;
  /** identifier -> set of files that define it */
  identDefs: Map<string, Set<string>>;
  /** identifier -> total reference count across all files */
  identRefCount: Map<string, number>;
  /** file -> files it imports (local only) */
  fileDeps: Map<string, string[]>;
}

// ─── Token Estimation ───────────────────────────────────────────────────────

type TokenEncoder = { encode(text: string): number[] };
let _encoder: TokenEncoder | null | undefined = undefined;

function getEncoder(): TokenEncoder | null {
  if (_encoder === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tiktoken = require("tiktoken");
      _encoder = tiktoken.encoding_for_model("gpt-4") as TokenEncoder;
    } catch {
      _encoder = null;
    }
  }
  return _encoder;
}

function estimateTokens(text: string): number {
  const enc = getEncoder();
  if (enc) {
    try {
      return enc.encode(text).length;
    } catch { /* fallback */ }
  }
  // Fallback: ~4 chars per token
  return Math.ceil(text.length / 4);
}

// ─── Regex-based Symbol Extraction ──────────────────────────────────────────

const EXPORT_REGEX = /^export\s+(?:async\s+)?(?:default\s+)?(class|interface|type|function|const|let|var)\s+([A-Za-z0-9_]+)/gm;
const ARROW_EXPORT_REGEX = /^export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)\s*(?::.+)?=\s*(?:async\s+)?(?:\(?.*?\)?\s*=>|function)/gm;

function regexScan(content: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const seen = new Set<string>();

  EXPORT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = EXPORT_REGEX.exec(content);
  while (match !== null) {
    const rawKind = match[1];
    const kind: SymbolInfo["kind"] = (rawKind === "const" || rawKind === "let" || rawKind === "var") ? "const" : rawKind as SymbolInfo["kind"];
    const name = match[2];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({ kind, name, signature: `${kind} ${name}`, isExported: true });
    }
    match = EXPORT_REGEX.exec(content);
  }

  ARROW_EXPORT_REGEX.lastIndex = 0;
  match = ARROW_EXPORT_REGEX.exec(content);
  while (match !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({ kind: "function", name, signature: `func ${name}`, isExported: true });
    }
    match = ARROW_EXPORT_REGEX.exec(content);
  }

  return symbols;
}

// ─── Reference Extraction (lightweight, no AST) ────────────────────────────

const IMPORT_REF_REGEX = /import\s+(?:type\s+)?(?:\{[^}]+\}|[\w*]+)\s+from\s+["']([^"']+)["']/g;
const IDENTIFIER_REGEX = /\b([A-Z][A-Za-z0-9_]*)\b/g;

function extractReferences(content: string): { importedModules: string[]; identifiers: Set<string> } {
  const importedModules: string[] = [];

  IMPORT_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = IMPORT_REF_REGEX.exec(content);
  while (match !== null) {
    importedModules.push(match[1]);
    match = IMPORT_REF_REGEX.exec(content);
  }

  const identifiers = new Set<string>();
  IDENTIFIER_REGEX.lastIndex = 0;
  match = IDENTIFIER_REGEX.exec(content);
  while (match !== null) {
    identifiers.add(match[1]);
    match = IDENTIFIER_REGEX.exec(content);
  }

  return { importedModules, identifiers };
}

// ─── AST-based Symbol Extraction ────────────────────────────────────────────

async function loadTsMorph() {
  const mod = await import("ts-morph");
  return mod;
}

async function analyzeFileWithAST(filePath: string, tsMorph: typeof import("ts-morph")): Promise<FileMap> {
  const { Project, SyntaxKind } = tsMorph;
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const content = await readFile(filePath, "utf-8");
  const sourceFile = project.createSourceFile(filePath, content);

  const symbols: SymbolInfo[] = [];
  const imports: Array<{ module: string; names: string[] }> = [];
  const exports: string[] = [];

  for (const decl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    const names: string[] = [];
    for (const named of decl.getNamedImports()) {
      names.push(named.getName());
    }
    const defaultImport = decl.getDefaultImport()?.getText();
    if (defaultImport) names.unshift(defaultImport);
    const namespaceImport = decl.getNamespaceImport();
    if (namespaceImport) names.push(`* as ${namespaceImport}`);
    if (names.length > 0) {
      imports.push({ module: moduleSpecifier, names });
    }
  }

  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName() ?? "(anonymous)";
    const isExported = cls.isExported();
    const methods: SymbolInfo["methods"] = [];
    const properties: SymbolInfo["properties"] = [];

    for (const method of cls.getMethods()) {
      const params = method.getParameters()
        .map((p) => {
          const type = p.getType().getText();
          return type !== "any" ? `${p.getName()}: ${type}` : p.getName();
        })
        .join(", ");
      const returnType = method.getReturnType().getText();
      const sig = `${method.getName()}(${params})${returnType !== "any" ? `: ${returnType}` : ""}`;
      methods!.push({ name: method.getName(), signature: sig, isStatic: method.isStatic() });
    }

    for (const prop of cls.getProperties()) {
      const type = prop.getType().getText();
      properties!.push({ name: prop.getName(), type: type !== "any" ? type : "..." });
    }

    const extendsExpr = cls.getExtends();
    const extendsClauses = extendsExpr ? [extendsExpr.getText()] : [];
    const implementsClauses = cls.getImplements().map((i) => i.getText());

    symbols.push({
      kind: "class",
      name,
      signature: `class ${name}${extendsClauses.length ? ` extends ${extendsClauses.join(", ")}` : ""}`,
      isExported,
      methods: methods!.length > 0 ? methods : undefined,
      properties: properties!.length > 0 ? properties : undefined,
      extends: extendsClauses.length > 0 ? extendsClauses : undefined,
      implements: implementsClauses.length > 0 ? implementsClauses : undefined,
    });

    if (isExported) exports.push(name);
  }

  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    const isExported = iface.isExported();
    const methods: SymbolInfo["methods"] = [];
    const properties: SymbolInfo["properties"] = [];

    for (const method of iface.getMethods()) {
      const params = method.getParameters()
        .map((p) => {
          const type = p.getType().getText();
          return type !== "any" ? `${p.getName()}: ${type}` : p.getName();
        })
        .join(", ");
      const returnType = method.getReturnType().getText();
      methods!.push({
        name: method.getName(),
        signature: `${method.getName()}(${params})${returnType !== "any" ? `: ${returnType}` : ""}`,
        isStatic: false,
      });
    }

    for (const prop of iface.getProperties()) {
      const type = prop.getType().getText();
      properties!.push({ name: prop.getName(), type: type !== "any" ? type : "..." });
    }

    const extendsClauses = iface.getExtends().map((e) => e.getText());

    symbols.push({
      kind: "interface",
      name,
      signature: `interface ${name}${extendsClauses.length ? ` extends ${extendsClauses.join(", ")}` : ""}`,
      isExported,
      methods: methods!.length > 0 ? methods : undefined,
      properties: properties!.length > 0 ? properties : undefined,
      extends: extendsClauses.length > 0 ? extendsClauses : undefined,
    });

    if (isExported) exports.push(name);
  }

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    const isExported = typeAlias.isExported();
    const text = typeAlias.getTypeNode()?.getText() ?? typeAlias.getType().getText();
    const preview = text.length > 120 ? text.slice(0, 120) + "..." : text;

    symbols.push({
      kind: "type",
      name,
      signature: `type ${name} = ${preview}`,
      isExported,
    });

    if (isExported) exports.push(name);
  }

  for (const enm of sourceFile.getEnums()) {
    const name = enm.getName();
    const isExported = enm.isExported();
    const members = enm.getMembers().map((m) => m.getName()).join(" | ");

    symbols.push({
      kind: "enum",
      name,
      signature: `enum ${name} { ${members} }`,
      isExported,
    });

    if (isExported) exports.push(name);
  }

  for (const stmt of sourceFile.getStatements()) {
    if (stmt.isKind(SyntaxKind.FunctionDeclaration)) {
      const fn = stmt.asKindOrThrow(SyntaxKind.FunctionDeclaration);
      const name = fn.getName() ?? "(anonymous)";
      const isExported = fn.isExported();
      const params = fn.getParameters()
        .map((p) => {
          const type = p.getType().getText();
          return type !== "any" ? `${p.getName()}: ${type}` : p.getName();
        })
        .join(", ");
      const returnType = fn.getReturnType().getText();

      symbols.push({
        kind: "function",
        name,
        signature: `${fn.isAsync() ? "async " : ""}function ${name}(${params})${returnType !== "any" ? `: ${returnType}` : ""}`,
        isExported,
      });

      if (isExported) exports.push(name);
    } else if (stmt.isKind(SyntaxKind.VariableStatement)) {
      const varStmt = stmt.asKindOrThrow(SyntaxKind.VariableStatement);
      const isExported = varStmt.isExported();
      if (!isExported) continue;
      for (const decl of varStmt.getDeclarationList().getDeclarations()) {
        const name = decl.getName();
        const type = decl.getType().getText();
        const isArrow = type.includes("=>") || type === "any";
        const kind = isArrow ? "function" : "const";

        symbols.push({
          kind,
          name,
          signature: `const ${name}${type !== "any" ? `: ${type.length > 80 ? type.slice(0, 80) + "..." : type}` : ""}`,
          isExported: true,
        });

        exports.push(name);
      }
    }
  }

  return { path: filePath, symbols, imports, exports };
}

// ─── Directory Scanner ──────────────────────────────────────────────────────

async function scanDirectory(
  dir: string,
  baseDir: string,
  maxDepth: number,
  currentDepth: number,
  tsMorph: typeof import("ts-morph"),
  includeImports: boolean,
  onProgress?: (message: string, percent: number) => void
): Promise<FileMap[]> {
  if (currentDepth > maxDepth) return [];

  const results: FileMap[] = [];

  async function getFiles(d: string, depth: number): Promise<string[]> {
    if (depth > maxDepth) return [];
    try {
      const entries = await readdir(d, { withFileTypes: true });
      const paths: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (["node_modules", "dist", ".git", "__pycache__", ".next", "build", "out"].includes(entry.name)) continue;
          paths.push(...await getFiles(join(d, entry.name), depth + 1));
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if ([".ts", ".tsx", ".js", ".jsx"].includes(ext) && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts")) {
            paths.push(join(d, entry.name));
          }
        }
      }
      return paths;
    } catch { return []; }
  }

  const allFiles = currentDepth === 0 ? await getFiles(dir, 0) : [];
  
  if (currentDepth === 0 && allFiles.length > 0) {
    let processed = 0;
    for (const filePath of allFiles) {
      processed++;
      const relPath = relative(baseDir, filePath).replace(/\\/g, "/");
      onProgress?.(`Analyzing ${relPath}`, (processed / allFiles.length) * 100);
      
      try {
        const fileMap = await analyzeFileWithAST(filePath, tsMorph);
        if (!includeImports) fileMap.imports = [];
        if (fileMap.symbols.length > 0 || (includeImports && fileMap.imports.length > 0)) {
          results.push(fileMap);
        }
      } catch {
        const content = await readFile(filePath, "utf-8");
        const symbols = regexScan(content);
        if (symbols.length > 0) {
          results.push({ path: filePath, symbols, imports: [], exports: symbols.map((s) => s.name) });
        }
      }
    }
  } else if (currentDepth > 0) {
    // Original recursive logic for non-root calls (though we optimized to handle all in root)
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (["node_modules", "dist", ".git", "__pycache__", ".next", "build", "out"].includes(entry.name)) continue;
        results.push(...await scanDirectory(join(dir, entry.name), baseDir, maxDepth, currentDepth + 1, tsMorph, includeImports, onProgress));
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext) && !entry.name.endsWith(".d.ts")) {
          // fallback scan
        }
      }
    }
  }

  return results;
}

// ─── Reference Graph Builder ────────────────────────────────────────────────

async function buildReferenceGraph(fileMaps: FileMap[], baseDir: string): Promise<ReferenceGraph> {
  const fileRefs = new Map<string, Set<string>>();
  const identDefs = new Map<string, Set<string>>();
  const identRefCount = new Map<string, number>();
  const fileDeps = new Map<string, string[]>();

  // Build identDefs: which files define each identifier
  for (const fm of fileMaps) {
    const relPath = relative(baseDir, fm.path).replace(/\\/g, "/");
    for (const sym of fm.symbols) {
      const existing = identDefs.get(sym.name) ?? new Set<string>();
      existing.add(relPath);
      identDefs.set(sym.name, existing);
    }
    for (const exp of fm.exports) {
      const existing = identDefs.get(exp) ?? new Set<string>();
      existing.add(relPath);
      identDefs.set(exp, existing);
    }
  }

  // Read file contents to extract references
  for (const fm of fileMaps) {
    const relPath = relative(baseDir, fm.path).replace(/\\/g, "/");
    try {
      const content = await readFile(fm.path, "utf-8");
      const { importedModules, identifiers } = extractReferences(content);

      fileRefs.set(relPath, identifiers);

      // Count references per identifier
      for (const ident of identifiers) {
        identRefCount.set(ident, (identRefCount.get(ident) ?? 0) + 1);
      }

      // Track local deps
      const locals = importedModules.filter((m) => m.startsWith(".") || m.startsWith("/"));
      if (locals.length > 0) {
        fileDeps.set(relPath, locals);
      }
    } catch { /* skip unreadable files */ }
  }

  return { fileRefs, identDefs, identRefCount, fileDeps };
}

// ─── Symbol Ranking (Aider-inspired PageRank-lite) ─────────────────────────

function rankSymbols(
  fileMaps: FileMap[],
  graph: ReferenceGraph,
  baseDir: string,
  focusFiles: string[],
): RankedSymbol[] {
  const ranked: RankedSymbol[] = [];
  const focusSet = new Set(focusFiles.map((f) => f.replace(/\\/g, "/")));

  for (const fm of fileMaps) {
    const relPath = relative(baseDir, fm.path).replace(/\\/g, "/");
    const isFocused = focusSet.has(relPath);

    for (const sym of fm.symbols) {
      let score = 0;

      // Base score by kind (classes/interfaces are more important)
      switch (sym.kind) {
        case "class": score += 10; break;
        case "interface": score += 8; break;
        case "function": score += 5; break;
        case "type": score += 4; break;
        case "enum": score += 3; break;
        case "const": score += 2; break;
      }

      // Export bonus
      if (sym.isExported) score += 3;

      // Has methods or properties (richer symbol)
      if (sym.methods && sym.methods.length > 0) score += Math.min(sym.methods.length, 5);
      if (sym.properties && sym.properties.length > 0) score += Math.min(sym.properties.length, 3);

      // Reference count bonus (how many files reference this symbol)
      const refCount = graph.identRefCount.get(sym.name) ?? 0;
      score += Math.sqrt(refCount) * 2;

      // Dampen common symbols (defined in many files = less interesting)
      const defCount = graph.identDefs.get(sym.name)?.size ?? 0;
      if (defCount > 5) score *= 0.3;

      // Focus file boost
      if (isFocused) score *= 3;

      // Inheritance bonus
      if (sym.extends && sym.extends.length > 0) score += 2;
      if (sym.implements && sym.implements.length > 0) score += 2;

      ranked.push({ fileMap: fm, symbol: sym, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

// ─── Token-Budget Compression (Binary Search) ──────────────────────────────

function renderRankedMap(rankedSymbols: RankedSymbol[], baseDir: string): string {
  // Group by file, preserving rank order
  const fileOrder: string[] = [];
  const fileSymbols = new Map<string, SymbolInfo[]>();

  for (const rs of rankedSymbols) {
    const relPath = relative(baseDir, rs.fileMap.path).replace(/\\/g, "/");
    if (!fileSymbols.has(relPath)) {
      fileOrder.push(relPath);
      fileSymbols.set(relPath, []);
    }
    fileSymbols.get(relPath)!.push(rs.symbol);
  }

  const lines: string[] = [];
  for (const relPath of fileOrder) {
    const syms = fileSymbols.get(relPath)!;
    lines.push(`[📁 ${relPath}]`);

    // Deduplicate symbols by name
    const seen = new Set<string>();
    for (const sym of syms) {
      if (seen.has(sym.name)) continue;
      seen.add(sym.name);

      const prefix = sym.isExported ? "  - " : "  ~ ";
      lines.push(`${prefix}${sym.signature}`);

      if (sym.properties && sym.properties.length > 0) {
        for (const prop of sym.properties.slice(0, 6)) {
          lines.push(`      ${prop.name}: ${prop.type.length > 60 ? prop.type.slice(0, 60) + "..." : prop.type}`);
        }
        if (sym.properties.length > 6) lines.push(`      ... +${sym.properties.length - 6} more`);
      }

      if (sym.methods && sym.methods.length > 0) {
        for (const method of sym.methods.slice(0, 8)) {
          lines.push(`      ${method.isStatic ? "static " : ""}${method.signature}`);
        }
        if (sym.methods.length > 8) lines.push(`      ... +${sym.methods.length - 8} more methods`);
      }
    }
  }

  return lines.join("\n");
}

function compressToTokenBudget(rankedSymbols: RankedSymbol[], baseDir: string, maxTokens: number): string {
  if (rankedSymbols.length === 0) return "";

  // Binary search for the number of symbols that fits within budget
  let lo = 1;
  let hi = rankedSymbols.length;
  let bestFit = "";
  let bestCount = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = renderRankedMap(rankedSymbols.slice(0, mid), baseDir);
    const tokens = estimateTokens(candidate);

    if (tokens <= maxTokens) {
      bestFit = candidate;
      bestCount = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // If we couldn't fit even 1 symbol, render a minimal version
  if (bestCount === 0 && rankedSymbols.length > 0) {
    const topSym = rankedSymbols[0];
    const relPath = relative(baseDir, topSym.fileMap.path).replace(/\\/g, "/");
    bestFit = `[📁 ${relPath}]\n  - ${topSym.symbol.signature}`;
  }

  return bestFit;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatFileMap(fileMap: FileMap, baseDir: string): string[] {
  const lines: string[] = [];
  const relPath = relative(baseDir, fileMap.path).replace(/\\/g, "/");

  lines.push(`[📁 ${relPath}]`);

  for (const sym of fileMap.symbols) {
    const prefix = sym.isExported ? "  - " : "  ~ ";
    lines.push(`${prefix}${sym.signature}`);

    if (sym.properties && sym.properties.length > 0) {
      for (const prop of sym.properties.slice(0, 8)) {
        lines.push(`      ${prop.name}: ${prop.type.length > 60 ? prop.type.slice(0, 60) + "..." : prop.type}`);
      }
      if (sym.properties.length > 8) {
        lines.push(`      ... +${sym.properties.length - 8} more properties`);
      }
    }

    if (sym.methods && sym.methods.length > 0) {
      for (const method of sym.methods.slice(0, 10)) {
        lines.push(`      ${method.isStatic ? "static " : ""}${method.signature}`);
      }
      if (sym.methods.length > 10) {
        lines.push(`      ... +${sym.methods.length - 10} more methods`);
      }
    }
  }

  if (fileMap.imports.length > 0) {
    lines.push(`  imports:`);
    for (const imp of fileMap.imports.slice(0, 5)) {
      lines.push(`    ${imp.names.join(", ")} ← "${imp.module}"`);
    }
    if (fileMap.imports.length > 5) {
      lines.push(`    ... +${fileMap.imports.length - 5} more imports`);
    }
  }

  return lines;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const get_repo_map_handler: ToolHandler = async (args, context) => {
  const targetDir = (args.dir as string) || "src";
  const maxDepth = (args.maxDepth as number) ?? 5;
  const includeImports = (args.includeImports as boolean) ?? false;
  const showDeps = (args.showDependencies as boolean) ?? false;
  const maxTokens = (args.maxTokens as number) ?? 2000;
  const focusFilesRaw = (args.focusFiles as string) ?? "";
  const focusFiles = focusFilesRaw ? focusFilesRaw.split(",").map((f: string) => f.trim()) : [];
  const absDir = resolve(targetDir);

  try {
    const s = await fsStat(absDir);
    if (!s.isDirectory()) {
      return { content: `Error: '${targetDir}' is not a directory`, isError: true };
    }
  } catch {
    return { content: `Error: directory '${targetDir}' does not exist`, isError: true };
  }

  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await loadTsMorph();
  } catch {
    return { content: "ts-morph not available. Install with: pnpm add ts-morph", isError: true };
  }

  try {
    const needImports = includeImports || showDeps;
    const fileMaps = await scanDirectory(absDir, absDir, maxDepth, 0, tsMorph, needImports, context?.onProgress);

    if (fileMaps.length === 0) {
      return { content: `No exported structures found in ${targetDir}` };
    }

    // Build reference graph for ranking
    const graph = await buildReferenceGraph(fileMaps, absDir);
    const graphSummary = await buildGraphSummary(absDir, focusFiles);

    // Rank symbols by relevance
    const ranked = rankSymbols(fileMaps, graph, absDir, focusFiles);

    // Use token-budget compression if maxTokens is set and reasonable
    // Skip compression when imports are requested (they're not part of ranked output)
    if (!includeImports && maxTokens > 0 && maxTokens < 10000) {
      const compressed = compressToTokenBudget(ranked, absDir, maxTokens);

      const header = `Repository Map for '${targetDir}' (${fileMaps.length} files, ranked by relevance, ~${estimateTokens(compressed)} tokens)\n`;
      const result = header + "\n" + compressed;

      // Optionally append dependency graph (not compressed)
      if (showDeps) {
        const depOutput = buildDependencyGraph(fileMaps, graph, absDir);
        return { content: result + (graphSummary ? "\n\n" + graphSummary : "") + "\n\n" + depOutput };
      }

      return { content: result + (graphSummary ? "\n\n" + graphSummary : "") };
    }

    // Fallback: full unranked output (original behavior)
    const output: string[] = [
      `Repository Map for '${targetDir}' (${fileMaps.length} files, AST analysis)\n`,
    ];

    for (const fileMap of fileMaps) {
      if (!includeImports) fileMap.imports = [];
      output.push(...formatFileMap(fileMap, absDir));
    }

    if (showDeps) {
      output.push("\n" + buildDependencyGraph(fileMaps, graph, absDir));
    }

    if (graphSummary) {
      output.push("\n" + graphSummary);
    }

    const result = output.join("\n");
    return {
      content: result.length > 50000
        ? result.slice(0, 50000) + "\n\n... (map truncated, codebase is too large)"
        : result,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error scanning repository: ${msg}`, isError: true };
  }
};

// ─── Dependency Graph (extracted from handler for reuse) ────────────────────

function buildDependencyGraph(fileMaps: FileMap[], graph: ReferenceGraph, baseDir: string): string {
  const lines: string[] = ["── Dependency Graph ──────────────────────\n"];

  lines.push("File → Imports:");
  for (const [file, deps] of graph.fileDeps) {
    lines.push(`  ${file} → ${deps.join(", ")}`);
  }

  // Module → imported by (most imported first)
  lines.push("\nModule → Imported by:");
  const importers = new Map<string, string[]>();
  for (const [file, deps] of graph.fileDeps) {
    for (const dep of deps) {
      const existing = importers.get(dep) ?? [];
      existing.push(file);
      importers.set(dep, existing);
    }
  }
  const sortedByUsage = [...importers.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [mod, files] of sortedByUsage.slice(0, 30)) {
    lines.push(`  ${mod} (${files.length} importers) ← ${files.slice(0, 5).join(", ")}${files.length > 5 ? ` +${files.length - 5} more` : ""}`);
  }

  // Circular dependency detection
  lines.push("\nCircular Dependencies:");
  let foundCircular = false;
  for (const [file, deps] of graph.fileDeps) {
    for (const dep of deps) {
      const depDeps = graph.fileDeps.get(dep);
      if (depDeps?.includes(file)) {
        lines.push(`  ⚠ ${file} ↔ ${dep}`);
        foundCircular = true;
      }
    }
  }
  if (!foundCircular) {
    lines.push("  None detected");
  }

  return lines.join("\n");
}

async function getAvailableGraph(baseDir: string): Promise<KnowledgeGraph | null> {
  const liveGraph = getGraphInstance();
  const liveRoot = getGraphRootDir();
  if (liveGraph && liveRoot && resolve(liveRoot) === resolve(baseDir)) {
    return liveGraph;
  }

  const cached = await loadGraphCache(baseDir);
  return cached?.graph ?? null;
}

async function buildGraphSummary(baseDir: string, focusFiles: string[]): Promise<string | null> {
  const graph = await getAvailableGraph(baseDir);
  if (!graph) return null;

  const stats = graph.getStats();
  const cycles = graph.findCycles("imports").slice(0, 5);
  const topHubs = graph
    .getNodesByKind("file")
    .map((node) => ({
      node,
      degree: graph.getInEdges(node.id, "imports").length + graph.getOutEdges(node.id, "imports").length,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  const lines: string[] = ["── GraphRAG Summary ──────────────────────", ""]; 
  lines.push(`Nodes: ${stats.nodeCount}, Edges: ${stats.edgeCount}`);
  lines.push(`Entity mix: files=${stats.fileCount}, classes=${stats.classCount}, interfaces=${stats.interfaceCount}, functions=${stats.functionCount}, methods=${stats.methodCount}`);

  if (topHubs.length > 0) {
    lines.push("", "Most connected files:");
    for (const hub of topHubs) {
      lines.push(`  ${hub.node.name} (${hub.degree} import edges)`);
    }
  }

  if (focusFiles.length > 0) {
    const normalizedFocus = focusFiles.map((f) => f.replace(/\\/g, "/"));
    const focusNodes = normalizedFocus.flatMap((file) => graph.getNodesByFile(file));
    if (focusNodes.length > 0) {
      lines.push("", "Focus file graph context:");
      for (const node of focusNodes.slice(0, 5)) {
        const related = graph.findRelated(node.id, 1);
        lines.push(`  ${node.name}: ${related.nodes.length} related entities, ${related.edges.length} edges`);
      }
    }
  }

  lines.push("", "Circular imports:");
  if (cycles.length === 0) {
    lines.push("  None detected");
  } else {
    for (const cycle of cycles) {
      const names = cycle.map((id) => graph.getNode(id)?.name ?? id);
      lines.push(`  ${names.join(" -> ")} -> ${names[0]}`);
    }
  }

  return lines.join("\n");
}
