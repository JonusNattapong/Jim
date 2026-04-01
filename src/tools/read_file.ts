import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { validateFilePath } from "./validation/tool-validation.js";
import { getToolError } from "./errors/error-catalogue.js";

export const read_file_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "read_file",
    description:
      "Read contents of a file. Use for understanding code before editing. Returns file with line numbers for precise reference.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative or absolute file path",
        },
        start_line: {
          type: "number",
          description: "Starting line number (1-indexed, optional)",
        },
        end_line: {
          type: "number",
          description: "Ending line number (inclusive, optional)",
        },
      },
      required: ["path"],
    },
  },
};

export const read_file_handler: ToolHandler = async (args) => {
  const filePath = args.path as string;
  const startLine = args.start_line as number | undefined;
  const endLine = args.end_line as number | undefined;

  // Validate file path
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid) {
    const error = getToolError("INVALID_FILE_PATH");
    return {
      content: `${error.title}\n\n${pathValidation.error}\n\n${error.suggestion}`,
      isError: true,
    };
  }

  try {
    const absPath = resolve(filePath);
    const content = await readFile(absPath, "utf-8");
    const lines = content.split("\n");

    if (startLine || endLine) {
      const start = Math.max(0, (startLine ?? 1) - 1);
      const end = Math.min(lines.length, endLine ?? lines.length);
      const selected = lines.slice(start, end);
      const numbered = selected
        .map((line, i) => `${String(start + i + 1).padStart(5)}→${line}`)
        .join("\n");
      return {
        content: `File: ${relative(process.cwd(), absPath)} (lines ${start + 1}-${end})\n${numbered}`,
      };
    }

    // Check if file is too large
    if (lines.length > 1000) {
      const error = getToolError("FILE_TOO_LARGE");
      return {
        content: `${error.title}\n\n${error.message} (${lines.length} lines)\n\n${error.suggestion}`,
        isError: true,
      };
    }

    const numbered = lines
      .map((line, i) => `${String(i + 1).padStart(5)}→${line}`)
      .join("\n");
    return {
      content: `File: ${relative(process.cwd(), absPath)} (${lines.length} lines)\n${numbered}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Categorize the error
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      const error = getToolError("FILE_NOT_FOUND");
      return {
        content: `${error.title}\n\n${error.message}: ${filePath}\n\n${error.suggestion}`,
        isError: true,
      };
    }

    if (msg.includes("EACCES") || msg.includes("permission denied")) {
      const error = getToolError("FILE_PERMISSION_DENIED");
      return {
        content: `${error.title}\n\n${error.message}\n\n${error.suggestion}`,
        isError: true,
      };
    }

    return { content: `Error reading file: ${msg}`, isError: true };
  }
};
