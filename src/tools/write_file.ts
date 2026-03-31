import { writeFile, mkdir, access } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { HistoryManager } from "../services/history-manager.js";

export const write_file_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing file with the given content. " +
      "Creates parent directories if they don't exist. " +
      "Use edit_file for modifying existing files — use this only for NEW files.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to create/overwrite",
        },
        content: {
          type: "string",
          description: "Full file content",
        },
      },
      required: ["path", "content"],
    },
  },
};

export const write_file_handler: ToolHandler = async (args) => {
  const filePath = args.path as string;
  const content = args.content as string;

  try {
    const absPath = resolve(filePath);
    await mkdir(dirname(absPath), { recursive: true });
    
    // Take snapshot before modification if file exists (Pillar 20)
    let snapshotId: string | null = null;
    try {
      await access(absPath);
      const history = new HistoryManager(process.cwd());
      await history.init();
      snapshotId = await history.takeSnapshot(absPath);
    } catch {
      // File doesn't exist, no snapshot needed
    }

    await writeFile(absPath, content, "utf-8");
    return {
      content: `Successfully wrote ${relative(process.cwd(), absPath)} (${content.split("\n").length} lines)${snapshotId ? ` (Snapshot: ${snapshotId})` : ""}`,
      diff: content.split("\n").map(l => "+ " + (l || " ")).slice(0, 50).join("\n") + (content.split("\n").length > 50 ? "\n... (truncated)" : ""),
      metadata: { snapshotId }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error writing file: ${msg}`, isError: true };
  }
};
