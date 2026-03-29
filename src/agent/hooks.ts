import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const execAsync = promisify(exec);

export type HookEvent = "PreToolUse" | "PostToolUse" | "SessionStart" | "SessionEnd" | "AgentTurn" | "PreSession" | "PostSession" | "OnCheckpoint";

export interface HookDefinition {
  event: HookEvent;
  toolPattern?: string;  // regex pattern for tool name (e.g. "run_command|bash")
  command: string;       // shell command to run
  description?: string;
}

export interface HookResult {
  blocked: boolean;
  output: string;
}

export class HookEngine {
  private hooks: HookDefinition[] = [];

  add(hook: HookDefinition): void {
    this.hooks.push(hook);
  }

  async loadFromFile(configPath: string = ".hooks.json"): Promise<void> {
    try {
      const content = await readFile(resolve(configPath), "utf-8");
      const defs = JSON.parse(content) as HookDefinition[];
      for (const h of defs) {
        this.add(h);
      }
    } catch {
      // No hooks file — that's fine
    }
  }

  async fire(event: HookEvent, context: Record<string, string> = {}): Promise<HookResult> {
    const relevant = this.hooks.filter((h) => h.event === event);

    for (const hook of relevant) {
      try {
        const env = { ...process.env, ...context };
        const { stdout, stderr } = await execAsync(hook.command, {
          timeout: 10000,
          env,
        });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();

        // Exit code 2 = block the operation
        if (output.includes("__BLOCK__")) {
          return { blocked: true, output: output.replace("__BLOCK__", "").trim() };
        }
      } catch (err: unknown) {
        const execErr = err as { code?: number; message?: string };
        if (execErr.code === 2) {
          return { blocked: true, output: execErr.message ?? "Hook blocked operation" };
        }
        // Other errors are non-fatal
      }
    }

    return { blocked: false, output: "" };
  }

  async fireForTool(toolName: string, context: Record<string, string> = {}): Promise<HookResult> {
    const relevant = this.hooks.filter((h) => {
      if (h.event !== "PreToolUse" && h.event !== "PostToolUse") return false;
      if (!h.toolPattern) return true; // No pattern = match all
      return new RegExp(h.toolPattern).test(toolName);
    });

    for (const hook of relevant) {
      try {
        const env = { ...process.env, ...context, TOOL_NAME: toolName };
        const { stdout } = await execAsync(hook.command, {
          timeout: 10000,
          env,
        });
        const output = stdout.trim();
        if (output.includes("__BLOCK__")) {
          return { blocked: true, output: output.replace("__BLOCK__", "").trim() };
        }
      } catch (err: unknown) {
        const execErr = err as { code?: number; message?: string };
        if (execErr.code === 2) {
          return { blocked: true, output: execErr.message ?? "Hook blocked" };
        }
      }
    }

    return { blocked: false, output: "" };
  }

  list(): HookDefinition[] {
    return [...this.hooks];
  }
}

/**
 * Example .hooks.json:
 * [
 *   {
 *     "event": "PreToolUse",
 *     "toolPattern": "run_command",
 *     "command": "echo 'About to run: $TOOL_NAME'",
 *     "description": "Log command execution"
 *   },
 *   {
 *     "event": "PostToolUse",
 *     "toolPattern": "edit_file",
 *     "command": "npx prettier --write $FILE_PATH 2>/dev/null || true",
 *     "description": "Auto-format after edit"
 *   },
 *   {
 *     "event": "PreToolUse",
 *     "toolPattern": "run_command",
 *     "command": "echo '$COMMAND' | grep -q 'rm -rf' && echo '__BLOCK__ Dangerous rm -rf' || true",
 *     "description": "Block rm -rf"
 *   },
 *   {
 *     "event": "PreSession",
 *     "command": "echo 'Session $SESSION_ID starting'",
 *     "description": "Log session start"
 *   },
 *   {
 *     "event": "PostSession",
 *     "command": "echo 'Session $SESSION_ID ended with $TURN_COUNT turns'",
 *     "description": "Log session end"
 *   },
 *   {
 *     "event": "OnCheckpoint",
 *     "command": "echo 'Checkpoint $CHECKPOINT_LABEL created for $SESSION_ID'",
 *     "description": "Log checkpoint creation"
 *   }
 * ]
 */
