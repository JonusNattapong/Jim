import { join } from "node:path";
import { rm } from "node:fs/promises";
import { childLogger } from "../utils/logger.js";
import type { ToolDefinition, ToolContext, ToolResult } from "./types.js";

const log = childLogger({ component: "tool-cleanup" });

export const cleanup_workspace_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cleanup_workspace",
    description:
      "Remove temporary files and artifacts created by the agent during the session (e.g., temp scripts, dry-run previews, log fragments). Use this before finishing a major task.",
    parameters: {
      type: "object",
      properties: {
        keep_logs: {
          type: "boolean",
          description: "Whether to keep log fragments for debugging.",
        },
      },
      required: [] as string[],
    },
  },
};

export async function cleanup_workspace_handler(
  args: { keep_logs?: boolean },
  context?: ToolContext,
): Promise<ToolResult> {
  const root = context?.projectRoot ?? process.cwd();
  const targets = [
    join(root, "temp_agent_script.py"),
    join(root, "temp_agent_script.sh"),
    join(root, "temp_agent_script.js"),
  ];

  const results: string[] = [];

  for (const target of targets) {
    try {
      await rm(target, { force: true });
      results.push(`Removed ${target}`);
    } catch (err) {
      log.debug({ err: String(err), target }, "Failed to remove target");
    }
  }

  // Cleanup .jim/tool-results if older or session-specific?
  // For now, let's just target the obvious temp files.

  return {
    content:
      results.length > 0 ? results.join("\n") : "Workspace is already clean.",
    isError: false,
  };
}
