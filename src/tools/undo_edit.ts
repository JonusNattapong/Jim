import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { HistoryManager } from "../services/history-manager.js";

export const undo_edit_definition: ToolDefinition = {
  name: "undo_edit",
  function: {
    name: "undo_edit",
    description: "Undo the last file edit or restore a file to a specific snapshot ID. Highly recommended if Jim makes a mistake or if you want to revert changes.",
    parameters: {
      type: "object",
      properties: {
        snapshotId: { type: "string", description: "Specific snapshot ID to restore. If omitted, lists recent snapshots." },
        confirm: { type: "boolean", description: "Must be true to apply the restoration." }
      },
      required: []
    }
  }
};

export const undo_edit_handler: ToolHandler = async (args: any, context) => {
  const history = new HistoryManager(context.projectRoot || process.cwd());
  await history.init();

  const snapshots = await history.getHistory();

  if (!args.snapshotId) {
    if (snapshots.length === 0) return { content: "No snapshots found in history." };
    
    const list = snapshots.reverse().slice(0, 10).map(s => 
      `- [${s.id}] ${s.filePath} (${new Date(s.timestamp).toLocaleString()})`
    ).join("\n");
    
    return { 
      content: `Recent snapshots (use snapshotId to restore):\n\n${list}\n\nCall undo_edit with a snapshotId and confirm: true to restore.` 
    };
  }

  if (!args.confirm) {
    return { content: `Please confirm you want to restore snapshot ${args.snapshotId} by setting confirm: true.`, isError: true };
  }

  const success = await history.restoreSnapshot(args.snapshotId);
  if (!success) return { content: `Error: Snapshot ${args.snapshotId} not found or failed to restore.`, isError: true };

  const entry = snapshots.find(s => s.id === args.snapshotId);
  return { content: `Successfully restored ${entry?.filePath} to state from snapshot ${args.snapshotId}. ✅` };
};
