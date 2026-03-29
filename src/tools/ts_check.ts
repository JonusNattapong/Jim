import { resolve, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolHandler } from "./types.js";

const execAsync = promisify(exec);

export const ts_check_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "ts_check",
    description:
      "Ask the TypeScript compiler for errors and diagnostics. Use this INSTEAD of guessing TypeScript syntax — " +
      "the compiler knows the exact types, imports, and errors. " +
      "Modes: 'project' (run tsc on entire project), 'file' (check a single file), 'hover' (get type info at a position).",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["project", "file", "hover"],
          description: "project = full tsc check, file = single file diagnostics, hover = type info at position",
        },
        path: {
          type: "string",
          description: "File path (required for 'file' and 'hover' modes)",
        },
        line: {
          type: "number",
          description: "1-indexed line number (required for 'hover' mode)",
        },
        column: {
          type: "number",
          description: "1-indexed column number (required for 'hover' mode)",
        },
        tsconfig: {
          type: "string",
          description: "Path to tsconfig.json (default: ./tsconfig.json)",
        },
      },
      required: ["mode"],
    },
  },
};

export const ts_check_handler: ToolHandler = async (args) => {
  const mode = (args.mode as string) ?? "project";

  switch (mode) {
    case "project":
      return runProjectCheck((args.tsconfig as string) ?? "tsconfig.json");
    case "file":
      return runFileCheck(args.path as string, (args.tsconfig as string) ?? "tsconfig.json");
    case "hover":
      return runHoverInfo(args.path as string, args.line as number, args.column as number, (args.tsconfig as string) ?? "tsconfig.json");
    default:
      return { content: `Unknown mode: ${mode}. Use 'project', 'file', or 'hover'.`, isError: true };
  }
};

async function runProjectCheck(tsconfigPath: string) {
  const absTsconfig = resolve(tsconfigPath);

  try {
    await readFile(absTsconfig, "utf-8");
  } catch {
    return { content: `tsconfig not found at ${absTsconfig}`, isError: true };
  }

  try {
    const { stdout, stderr } = await execAsync(`npx tsc --noEmit --pretty false`, {
      cwd: resolve("."),
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    if (!output) {
      return { content: "✅ No TypeScript errors. Project compiles clean." };
    }
    return formatTscOutput(output);
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || e.message || "Unknown error";
    return formatTscOutput(output);
  }
}

function formatTscOutput(raw: string): { content: string; isError: boolean } {
  const lines = raw.split("\n").filter((l) => l.trim());
  const errorLines = lines.filter((l) => /error TS\d+/.test(l) && !l.includes("node_modules"));

  if (errorLines.length === 0) {
    return { content: "✅ No TypeScript errors in project source.", isError: false };
  }

  const grouped = new Map<string, string[]>();
  for (const line of errorLines) {
    const fileMatch = line.match(/^(.+?)\(\d+,\d+\)/);
    const file = fileMatch ? fileMatch[1] : "unknown";
    const entries = grouped.get(file) ?? [];
    entries.push(line.trim());
    grouped.set(file, entries);
  }

  let output = `Found ${errorLines.length} TypeScript error(s) in ${grouped.size} file(s):\n\n`;

  for (const [file, errors] of grouped) {
    const relFile = relative(process.cwd(), file);
    output += `📄 ${relFile} (${errors.length} error${errors.length > 1 ? "s" : ""})\n`;
    for (const err of errors.slice(0, 10)) {
      const clean = err.replace(file, relFile);
      output += `  ${clean}\n`;
    }
    if (errors.length > 10) {
      output += `  ... and ${errors.length - 10} more\n`;
    }
    output += "\n";
  }

  return {
    content: output.slice(0, 5000),
    isError: true,
  };
}

async function runFileCheck(filePath: string | undefined, tsconfigPath: string) {
  if (!filePath) {
    return { content: "Error: 'path' is required for file mode", isError: true };
  }

  const absPath = resolve(filePath);

  try {
    await readFile(absPath, "utf-8");
  } catch {
    return { content: `File not found: ${absPath}`, isError: true };
  }

  try {
    // Run tsc with project tsconfig, then filter for our file
    const { stdout, stderr } = await execAsync(
      `npx tsc --noEmit --pretty false --skipLibCheck`,
      { cwd: resolve("."), timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    if (!output) {
      return { content: `✅ ${relative(process.cwd(), absPath)} — no errors` };
    }

    // Filter to only show errors from the target file
    const relPath = relative(process.cwd(), absPath);
    const filteredLines = output.split("\n").filter((l) =>
      l.includes(absPath) || l.includes(relPath)
    );

    if (filteredLines.length === 0) {
      return { content: `✅ ${relPath} — no errors` };
    }

    return formatTscOutput(filteredLines.join("\n"));
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const rawOutput = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || e.message || "Unknown error";

    // Filter to only show errors from the target file
    const relPath = relative(process.cwd(), absPath);
    const filteredLines = rawOutput.split("\n").filter((l) =>
      l.includes(absPath) || l.includes(relPath)
    );

    if (filteredLines.length === 0) {
      return { content: `✅ ${relPath} — no errors` };
    }

    return formatTscOutput(filteredLines.join("\n"));
  }
}

async function runHoverInfo(
  filePath: string | undefined,
  line: number | undefined,
  column: number | undefined,
  _tsconfigPath: string,
) {
  if (!filePath || !line || !column) {
    return { content: "Error: 'path', 'line', and 'column' are required for hover mode", isError: true };
  }

  const absPath = resolve(filePath);

  try {
    // Dynamic import typescript (it's a dev dep, may or may not be ESM)
    const ts = await loadTypeScript();
    if (!ts) {
      return { content: "TypeScript module not found. Make sure typescript is installed.", isError: true };
    }

    const configFile = ts.findConfigFile(resolve("."), ts.sys.fileExists, "tsconfig.json");
    let compilerOptions: any = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true };

    if (configFile) {
      const configText = ts.sys.readFile(configFile);
      if (configText) {
        const parsed = ts.parseConfigFileTextToJson(configFile, configText);
        if (parsed.config) {
          const parsedConfig = ts.parseJsonConfigFileContent(parsed.config, ts.sys, resolve("."));
          compilerOptions = parsedConfig.options;
        }
      }
    }

    const program = ts.createProgram([absPath], compilerOptions);
    const sourceFile = program.getSourceFile(absPath);

    if (!sourceFile) {
      return { content: `Could not load source file: ${absPath}`, isError: true };
    }

    const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
    const checker = program.getTypeChecker();

    // Find the node at the position
    const node = findNodeAtPosition(sourceFile, position);
    if (!node) {
      return { content: `No AST node found at ${filePath}:${line}:${column}` };
    }

    const results: string[] = [];

    // Get type of node
    try {
      const type = checker.getTypeAtLocation(node);
      const typeString = checker.typeToString(type, node);
      results.push(`Type: ${typeString}`);
    } catch { /* skip */ }

    // Get symbol info
    try {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        results.push(`Symbol: ${symbol.getName()}`);
        const declarations = symbol.getDeclarations();
        if (declarations && declarations.length > 0) {
          const decl = declarations[0];
          const declFile = decl.getSourceFile().fileName;
          const declPos = decl.getSourceFile().getLineAndCharacterOfPosition(decl.getStart());
          results.push(`Defined at: ${relative(process.cwd(), declFile)}:${declPos.line + 1}:${declPos.character + 1}`);
        }
      }
    } catch { /* skip */ }

    // Get quick info (hover text)
    try {
      const quickInfo = ts.getQuickInfoAtPosition(absPath, program, position);
      if (quickInfo) {
        const displayParts = quickInfo.displayParts?.map((p: any) => p.text).join("") ?? "";
        const documentation = quickInfo.documentation?.map((p: any) => p.text).join("") ?? "";
        if (displayParts) results.push(`Hover: ${displayParts}`);
        if (documentation) results.push(`Docs: ${documentation}`);
      }
    } catch { /* skip */ }

    if (results.length === 0) {
      return { content: `No type information available at ${filePath}:${line}:${column}` };
    }

    return { content: `📍 ${relative(process.cwd(), absPath)}:${line}:${column}\n${results.join("\n")}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Hover info failed: ${msg}`, isError: true };
  }
}

function findNodeAtPosition(sourceFile: any, position: number): any {
  const ts = (globalThis as any).__ts_module;
  if (!ts) return null;

  function find(node: any): any {
    if (position >= node.getStart(sourceFile) && position < node.getEnd()) {
      return ts.forEachChild(node, find) ?? node;
    }
    return undefined;
  }

  return find(sourceFile);
}

async function loadTypeScript(): Promise<any | null> {
  try {
    // Try dynamic import first (ESM)
    const ts = await import("typescript");
    (globalThis as any).__ts_module = ts.default ?? ts;
    return ts.default ?? ts;
  } catch {
    try {
      // Fallback to require (CJS)
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const ts = require("typescript");
      (globalThis as any).__ts_module = ts;
      return ts;
    } catch {
      return null;
    }
  }
}
