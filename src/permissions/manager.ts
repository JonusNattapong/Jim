import { createInterface } from "node:readline";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

export type PermissionMode = "plan" | "edit" | "ask";

interface PermissionEntry {
  toolName: string;
  pattern: string;      // wildcard pattern for matching
  approved: boolean;
  timestamp: string;
}

/**
 * Convert a tool call to a matchable signature string.
 * e.g. run_command with {command: "echo hi", cwd: "/tmp"} → "run_command:command=echo hi,cwd=/tmp"
 */
function toSignature(toolName: string, args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args).sort()) {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    parts.push(`${k}=${val}`);
  }
  return `${toolName}:${parts.join(",")}`;
}

/**
 * Test if a wildcard pattern matches a signature.
 * Supports:
 *   - `toolName:*` — matches any args for that tool
 *   - `toolName:command=echo*` — matches when command starts with "echo"
 *   - `toolName:command=echo hi,cwd=/tmp` — exact match
 */
function wildcardMatch(pattern: string, signature: string): boolean {
  if (pattern === signature) return true;

  const [pTool, ...pRest] = pattern.split(":");
  const [sTool, ...sRest] = signature.split(":");

  if (pTool !== sTool) return false;

  const pArgs = pRest.join(":");
  const sArgs = sRest.join(":");

  // Wildcard: matches everything for this tool
  if (pArgs === "*") return true;

  // Pattern has wildcard suffix: "command=echo*"
  if (pArgs.endsWith("*")) {
    return sArgs.startsWith(pArgs.slice(0, -1));
  }

  // Exact match on args
  return pArgs === sArgs;
}

/**
 * Permission levels:
 * - plan: Read-only, no edits or commands
 * - edit: Auto-approve file edits, ask for shell commands
 * - ask: Ask before all edits and shell commands
 */
export class PermissionManager {
  private mode: PermissionMode;
  private allowPatterns: RegExp[] = [];
  private denyPatterns: RegExp[] = [];
  private persistedDecisions = new Map<string, boolean>();
  private projectRoot: string;
  private planApproved = false;

  constructor(mode: PermissionMode = "ask", projectRoot: string = ".") {
    this.mode = mode;
    this.projectRoot = projectRoot;
  }

  private getJimDir(): string {
    return join(this.projectRoot, ".jim");
  }

  async loadPersisted(): Promise<void> {
    try {
      const dir = this.getJimDir();
      const filePath = join(dir, "permissions.json");
      const content = await readFile(filePath, "utf-8");
      const entries = JSON.parse(content) as PermissionEntry[];
      for (const entry of entries) {
        this.persistedDecisions.set(`${entry.toolName}:${entry.pattern}`, entry.approved);
      }
    } catch { /* no persisted permissions */ }
  }

  async saveDecision(toolName: string, args: Record<string, unknown>, approved: boolean): Promise<void> {
    // Store as wildcard pattern for the tool (approve/deny all calls to this tool)
    const pattern = "*";
    const key = `${toolName}:${pattern}`;
    this.persistedDecisions.set(key, approved);

    try {
      const dir = this.getJimDir();
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, "permissions.json");

      const entries: PermissionEntry[] = [];
      for (const [k, v] of this.persistedDecisions) {
        const [name, ...rest] = k.split(":");
        entries.push({
          toolName: name,
          pattern: rest.join(":"),
          approved: v,
          timestamp: new Date().toISOString(),
        });
      }

      await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch { /* non-fatal */ }
  }

  /**
   * Save a more specific wildcard pattern for persisted permission.
   * Examples:
   *   - savePattern("run_command:command=echo*", true) — approve all echo commands
   *   - savePattern("write_file:path=*.json", true) — approve writes to JSON files
   */
  async savePattern(pattern: string, approved: boolean): Promise<void> {
    this.persistedDecisions.set(pattern, approved);

    try {
      const dir = this.getJimDir();
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, "permissions.json");

      const entries: PermissionEntry[] = [];
      for (const [k, v] of this.persistedDecisions) {
        const [name, ...rest] = k.split(":");
        entries.push({
          toolName: name,
          pattern: rest.join(":"),
          approved: v,
          timestamp: new Date().toISOString(),
        });
      }

      await writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch { /* non-fatal */ }
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  setPlanApproved(approved: boolean): void {
    this.planApproved = approved;
  }

  isPlanApproved(): boolean {
    return this.planApproved;
  }

  addAllowPattern(pattern: string): void {
    this.allowPatterns.push(new RegExp(pattern));
  }

  addDenyPattern(pattern: string): void {
    this.denyPatterns.push(new RegExp(pattern));
  }

  async check(toolName: string, args: Record<string, unknown>): Promise<{
    allowed: boolean;
    reason?: string;
    needsApproval: boolean;
  }> {
    // Plan Approval Guardrail
    const mutationTools = ["edit_file", "write_file", "run_command", "delete_file", "apply_diff"];
    if (mutationTools.includes(toolName) && !this.planApproved) {
      return { 
        allowed: false, 
        reason: "Plan not approved. You must use todo_write to propose a plan and ask the user for approval before using mutation tools.", 
        needsApproval: false 
      };
    }

    const toolSignature = `${toolName}(${JSON.stringify(args)})`;

    // Check deny patterns
    for (const pattern of this.denyPatterns) {
      if (pattern.test(toolSignature)) {
        return { allowed: false, reason: `Blocked by deny rule: ${pattern}`, needsApproval: false };
      }
    }

    // Check allow patterns
    for (const pattern of this.allowPatterns) {
      if (pattern.test(toolSignature)) {
        return { allowed: true, needsApproval: false };
      }
    }

    // Check persisted decisions (wildcard matching)
    const signature = toSignature(toolName, args);
    for (const [pattern, approved] of this.persistedDecisions) {
      if (wildcardMatch(pattern, signature)) {
        if (!approved) {
          return { allowed: false, reason: "Previously denied by user", needsApproval: false };
        }
        return { allowed: true, needsApproval: false };
      }
    }

    // Plan mode
    if (this.mode === "plan") {
      const readOnlyTools = ["read_file", "list_files", "grep", "get_project_info", "git_command"];
      if (readOnlyTools.includes(toolName)) return { allowed: true, needsApproval: false };
      return { allowed: false, reason: "Plan mode: read-only", needsApproval: false };
    }

    // edit mode
    if (this.mode === "edit") {
      const editTools = ["read_file", "list_files", "grep", "edit_file", "write_file", "get_project_info", "git_command"];
      if (editTools.includes(toolName)) return { allowed: true, needsApproval: false };
      if (toolName === "run_command") return { allowed: true, needsApproval: true };
    }

    // ask mode
    const safeTools = [
      "read_file", "list_files", "grep", "get_project_info", "git_command",
      "web_fetch", "web_search", "todo_write", "ask_user_choice", "list_plugins",
    ];
    if (safeTools.includes(toolName)) return { allowed: true, needsApproval: false };

    return { allowed: true, needsApproval: true };
  }

  async approve(prompt: string): Promise<boolean> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${prompt} [y/N] `, (answer) => {
        rl.close();
        const approved = answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
        resolve(approved);
      });
    });
  }
}
