import { glob } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";

export const list_files_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "list_files",
    description:
      "List files matching a glob pattern. Use to discover project structure, " +
      "find specific file types, or locate files before reading them. " +
      "Examples: '**/*.ts', 'src/**', 'package.json'",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern (e.g. '**/*.py', 'src/**', '*.json')",
        },
        path: {
          type: "string",
          description: "Base directory to search from (default: current dir)",
        },
      },
      required: ["pattern"],
    },
  },
};

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
]);

export const list_files_handler: ToolHandler = async (args) => {
  const pattern = args.pattern as string;
  const basePath = (args.path as string) ?? ".";

  try {
    const absBase = resolve(basePath);
    const matches: string[] = [];

    for await (const entry of glob(pattern, { cwd: absBase })) {
      const rel = relative(process.cwd(), resolve(absBase, entry));
      // Skip ignored directories
      const parts = rel.replace(/\\/g, "/").split("/");
      const hasIgnored = parts.some((p) => IGNORE_DIRS.has(p));
      if (!hasIgnored) {
        matches.push(rel);
      }
    }

    if (matches.length === 0) {
      return { content: `No files found matching: ${pattern}` };
    }

    const sorted = matches.sort();
    const truncated =
      sorted.length > 100
        ? sorted.slice(0, 100).join("\n") + `\n... and ${sorted.length - 100} more`
        : sorted.join("\n");

    return { content: `Found ${sorted.length} files:\n${truncated}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error listing files: ${msg}`, isError: true };
  }
};
