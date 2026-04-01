import { spawn } from "node:child_process";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { validateRegexPattern } from "./validation/tool-validation.js";
import { getCommandSemantics } from "./semantics/command-semantics.js";
import { getToolError } from "./errors/error-catalogue.js";

export const grep_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "grep",
    description:
      "Search file contents using ripgrep (fast regex search). " +
      "Use to find where functions, classes, variables are defined/used. " +
      "Much faster than reading entire files. Output truncated to 5000 chars.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex pattern to search for",
        },
        path: {
          type: "string",
          description: "Directory or file to search in (default: current dir)",
        },
        glob: {
          type: "string",
          description: "File glob filter (e.g. '*.ts', '*.py')",
        },
        context_lines: {
          type: "number",
          description: "Lines of context around matches (default: 2)",
        },
        case_insensitive: {
          type: "boolean",
          description: "Case-insensitive search (default: false)",
        },
        max_results: {
          type: "number",
          description: "Max number of results (default: 50)",
        },
      },
      required: ["pattern"],
    },
  },
};

export const grep_handler: ToolHandler = async (args) => {
  const pattern = args.pattern as string;
  const searchPath = (args.path as string) ?? ".";
  const globFilter = args.glob as string | undefined;
  const contextLines = ((args.context_lines as number) ?? 2);
  const caseInsensitive = (args.case_insensitive as boolean) ?? false;
  const maxResults = (args.max_results as number) ?? 50;

  // Validate regex pattern
  const patternValidation = validateRegexPattern(pattern);
  if (!patternValidation.valid) {
    const error = getToolError("INVALID_REGEX_PATTERN");
    return {
      content: `${error.title}\n\n${patternValidation.error}\n\n${error.suggestion}`,
      isError: true,
    };
  }

  const rgArgs: string[] = [
    "-C", String(contextLines),
    "--max-count", String(maxResults),
    "--no-heading",
    "--line-number",
  ];

  if (caseInsensitive) rgArgs.push("-i");

  rgArgs.push("-g", "!node_modules", "-g", "!.git", "-g", "!dist", "-g", "!build", "-g", "!__pycache__");

  if (globFilter) rgArgs.push("-g", globFilter);

  rgArgs.push(pattern, searchPath);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let done = false;

    const child = spawn("rg", rgArgs, { timeout: 15000, env: process.env });

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    const killTimer = setTimeout(() => { if (!done) { child.kill(); done = true; } }, 15000);

    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);

      // Use command semantics to interpret exit code
      const semantics = getCommandSemantics("rg");
      if (semantics) {
        const interpreted = semantics(code, stdout, stderr);
        if (!interpreted.isError) {
          const message = interpreted.message || `No matches found for: ${pattern}`;
          resolve({ content: message });
          return;
        }
      }

      if (code !== 0) {
        const error = getToolError("COMMAND_FAILED");
        resolve({ content: `${error.title}\n\n${stderr || stdout}`, isError: true });
        return;
      }

      if (!stdout.trim()) {
        const error = getToolError("NO_MATCHES_FOUND");
        resolve({ content: error.message });
        return;
      }

      const output = stdout.length > 5000
        ? stdout.slice(0, 5000) + `\n... (${stdout.length - 5000} chars truncated)`
        : stdout;

      resolve({ content: output });
    });

    child.on("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      
      if (err.message.includes("ENOENT")) {
        const error = getToolError("COMMAND_NOT_FOUND");
        resolve({ content: `${error.title}\n\nripgrep not installed.\n\n${error.suggestion}`, isError: true });
        return;
      }

      resolve({ content: `grep error: ${err.message}`, isError: true });
    });
  });
};
