import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";

export const git_command_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "git_command",
    description:
      "Run a safe git operation (diff, status, log, branch). " +
      "Use this instead of run_command for git to ensure safety.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Git subcommand (e.g. 'diff', 'status', 'log --oneline -10', 'branch')",
        },
      },
      required: ["command"],
    },
  },
};

export const git_command_handler: ToolHandler = async (args) => {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const subcmd = args.command as string;
  const fullCmd = `git ${subcmd}`;

  // Block dangerous git operations
  const dangerous = [
    /\bgit\s+push\s+--force\b/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bgit\s+clean\s+-fd\b/i,
    /\bgit\s+branch\s+-D\b/i,
    /\bgit\s+filter-branch\b/i,
  ];

  if (dangerous.some((p) => p.test(fullCmd))) {
    return {
      content: `⚠️  Dangerous git command blocked: ${fullCmd}`,
      isError: true,
    };
  }

  try {
    const { stdout, stderr } = await execAsync(fullCmd, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return { content: [stdout, stderr].filter(Boolean).join("\n") || "(no output)" };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      content: `git error: ${e.stderr ?? e.stdout ?? e.message}`,
      isError: true,
    };
  }
};

export const get_project_info_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "get_project_info",
    description:
      "Get project metadata (package.json, README, language detection). " +
      "Use at session start to understand the project.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const get_project_info_handler: ToolHandler = async () => {
  const info: string[] = [];

  // Try package.json
  try {
    const pkg = JSON.parse(await readFile(resolve("package.json"), "utf-8"));
    info.push(`Name: ${pkg.name ?? "unknown"}`);
    info.push(`Version: ${pkg.version ?? "unknown"}`);
    if (pkg.scripts) {
      const scripts = Object.keys(pkg.scripts).join(", ");
      info.push(`Scripts: ${scripts}`);
    }
    if (pkg.dependencies) {
      const deps = Object.keys(pkg.dependencies).join(", ");
      info.push(`Dependencies: ${deps}`);
    }
  } catch {
    info.push("No package.json found");
  }

  // Try pyproject.toml
  try {
    await readFile(resolve("pyproject.toml"), "utf-8");
    info.push("Has pyproject.toml (Python project)");
  } catch { /* not a Python project */ }

  // Try Cargo.toml
  try {
    await readFile(resolve("Cargo.toml"), "utf-8");
    info.push("Has Cargo.toml (Rust project)");
  } catch { /* not a Rust project */ }

  // Try go.mod
  try {
    await readFile(resolve("go.mod"), "utf-8");
    info.push("Has go.mod (Go project)");
  } catch { /* not a Go project */ }

  return { content: info.join("\n") };
};
