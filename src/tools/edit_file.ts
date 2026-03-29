import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { createDiff } from "../utils/diff.js";

export const edit_file_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "edit_file",
    description:
      "Replace exact lines in a file by specifying a start and end line number. " +
      "This is faster and saves tokens compared to writing the whole file. " +
      "Start and end lines are 1-indexed (inclusive). Let start_line = end_line to replace a single line.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to edit",
        },
        start_line: {
          type: "number",
          description: "1-indexed starting line number of the block to replace",
        },
        end_line: {
          type: "number",
          description: "1-indexed ending line number of the block to replace (inclusive)",
        },
        new_text: {
          type: "string",
          description: "New content to replace the specified block. Provide multiple lines if needed.",
        },
      },
      required: ["path", "start_line", "end_line", "new_text"],
    },
  },
};

export const edit_file_handler: ToolHandler = async (args) => {
  const filePath = args.path as string;
  const startLine = args.start_line as number;
  const endLine = args.end_line as number;
  const newText = args.new_text as string;

  try {
    const absPath = resolve(filePath);
    const content = await readFile(absPath, "utf-8");

    const isWindows = content.includes("\r\n");
    const lines = content.split(/\r?\n/);

    if (startLine < 1 || startLine > lines.length + 1) {
      return { content: `Error: start_line ${startLine} is out of bounds (1-${lines.length + 1}).`, isError: true };
    }
    if (endLine < startLine) {
      return { content: `Error: end_line ${endLine} must be >= start_line ${startLine}.`, isError: true };
    }

    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const newLines = newText.split(/\r?\n/);

    const updated = [...before, ...newLines, ...after].join(isWindows ? "\r\n" : "\n");
    await writeFile(absPath, updated, "utf-8");

    const oldTextStr = lines.slice(startLine - 1, endLine).join(isWindows ? "\r\n" : "\n");
    const newTextStr = newLines.join(isWindows ? "\r\n" : "\n");

    return {
      content: `Successfully replaced lines ${startLine}-${endLine} in ${relative(process.cwd(), absPath)}`,
      diff: createDiff(oldTextStr, newTextStr),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error editing file: ${msg}`, isError: true };
  }
};
