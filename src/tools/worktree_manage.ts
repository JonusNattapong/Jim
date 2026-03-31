import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import type { ToolDefinition, ToolHandler } from "./types.js";

const execAsync = promisify(exec);

export const worktree_manage_definition: ToolDefinition = {
  name: "worktree_manage",
  function: {
    name: "worktree_manage",
    description: "Manage Git worktrees for isolated task execution. This allows creating a separate directory to work on a different branch without affecting the current working directory.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "list", "remove"], description: "The action to perform" },
        branch: { type: "string", description: "The branch name (for 'add')" },
        path: { type: "string", description: "The directory path for the new worktree (for 'add' and 'remove')" }
      },
      required: ["action"]
    }
  }
};

export const worktree_manage_handler: ToolHandler = async (args: any, context) => {
  const projectRoot = context.projectRoot || process.cwd();

  try {
    switch (args.action) {
      case "add": {
        if (!args.branch || !args.path) {
          return { content: "Error: 'branch' and 'path' are required for 'add' action.", isError: true };
        }
        const fullPath = path.resolve(projectRoot, args.path);
        const { stdout, stderr } = await execAsync(`git worktree add "${fullPath}" ${args.branch}`, { cwd: projectRoot });
        return { content: `Worktree created at ${args.path} for branch ${args.branch}.\n\n${stdout || stderr}` };
      }
      case "list": {
        const { stdout } = await execAsync("git worktree list", { cwd: projectRoot });
        return { content: `Current Git Worktrees:\n\n${stdout}` };
      }
      case "remove": {
        if (!args.path) {
          return { content: "Error: 'path' is required for 'remove' action.", isError: true };
        }
        const fullPath = path.resolve(projectRoot, args.path);
        const { stdout, stderr } = await execAsync(`git worktree remove "${fullPath}"`, { cwd: projectRoot });
        return { content: `Worktree at ${args.path} removed.\n\n${stdout || stderr}` };
      }
      default:
        return { content: `Invalid action: ${args.action}`, isError: true };
    }
  } catch (error: any) {
    return { content: `Git Worktree Error: ${error.message}`, isError: true };
  }
};
