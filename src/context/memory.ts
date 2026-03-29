import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

export interface MemoryLayer {
  path: string;
  content: string;
  scope: "global" | "project" | "personal" | "conditional" | "learned";
  globs?: string[];  // File patterns this rule applies to
}

interface RuleFrontmatter {
  globs: string[];
  description: string;
  alwaysApply: boolean;
}

/**
 * Loads CLAUDE.md, AGENTS.md, MEMORY.md, and .claude/rules/*.md
 * following the layered memory hierarchy with conditional rules.
 */
export class MemoryManager {
  private projectRoot: string;
  private layers: MemoryLayer[] = [];
  private conditionalRules: MemoryLayer[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async loadAll(): Promise<string> {
    this.layers = [];
    this.conditionalRules = [];

    const globalHome = process.env.HOME ?? process.env.USERPROFILE ?? "";
    if (globalHome) {
      await this.loadFile(resolve(globalHome, ".claude", "CLAUDE.md"), "global");
    }

    await this.loadFile(join(this.projectRoot, "CLAUDE.md"), "project");
    await this.loadFile(join(this.projectRoot, "AGENTS.md"), "project");
    await this.loadFile(join(this.projectRoot, "CLAUDE.local.md"), "personal");
    await this.loadRules();
    await this.loadMemory();

    return this.buildContext();
  }

  private async loadFile(filePath: string, scope: MemoryLayer["scope"]): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      if (content.trim()) {
        this.layers.push({ path: filePath, content: content.trim(), scope });
      }
    } catch { /* file doesn't exist */ }
  }

  /**
   * Load .claude/rules/*.md with optional YAML frontmatter for conditional loading.
   * If alwaysApply=true or no frontmatter, rule is always loaded.
   * If globs specified, rule is only injected when working with matching files.
   */
  private async loadRules(): Promise<void> {
    const rulesDir = join(this.projectRoot, ".claude", "rules");
    try {
      const files = await readdir(rulesDir);
      for (const file of files.sort()) {
        if (file.endsWith(".md")) {
          const filePath = join(rulesDir, file);
          try {
            const raw = await readFile(filePath, "utf-8");
            const parsed = this.parseFrontmatter(raw);

            if (parsed.alwaysApply || !parsed.globs.length) {
              // Always-inject rules go into main layers
              this.layers.push({
                path: filePath,
                content: parsed.content,
                scope: "conditional",
              });
            } else {
              // Conditional rules stored separately
              this.conditionalRules.push({
                path: filePath,
                content: parsed.content,
                scope: "conditional",
                globs: parsed.globs,
              });
            }
          } catch { /* skip corrupt files */ }
        }
      }
    } catch { /* no rules directory */ }
  }

  /**
   * Parse YAML frontmatter from markdown content.
   * Supports: ---\nkey: value\n---\ncontent
   */
  private parseFrontmatter(raw: string): RuleFrontmatter & { content: string } {
    const defaults: RuleFrontmatter = { globs: [], description: "", alwaysApply: true };

    if (!raw.startsWith("---")) {
      return { ...defaults, content: raw.trim() };
    }

    const endIdx = raw.indexOf("---", 3);
    if (endIdx === -1) return { ...defaults, content: raw.trim() };

    const frontmatter = raw.slice(3, endIdx).trim();
    const content = raw.slice(endIdx + 3).trim();

    const result = { ...defaults, content };

    for (const line of frontmatter.split("\n")) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();

      switch (key?.trim()) {
        case "globs":
          // Parse: ["*.ts", "src/**/*.js"] or *.ts
          try {
            result.globs = JSON.parse(value);
          } catch {
            result.globs = [value];
          }
          break;
        case "description":
          result.description = value;
          break;
        case "alwaysApply":
          result.alwaysApply = value === "true";
          break;
      }
    }

    return result;
  }

  private async loadMemory(): Promise<void> {
    try {
      const content = await readFile(join(this.projectRoot, "MEMORY.md"), "utf-8");
      const lines = content.split("\n");
      const truncated = lines.slice(0, 200).join("\n");
      if (truncated.trim()) {
        this.layers.push({
          path: "MEMORY.md (auto-learned)",
          content: truncated,
          scope: "learned",
        });
      }
    } catch { /* no MEMORY.md */ }
  }

  /**
   * Build context string for system prompt.
   */
  buildContext(): string {
    return this.buildContextForFiles();
  }

  /**
   * Build context for specific files being worked on.
   * Injects conditional rules that match the given file paths.
   */
  buildContextForFiles(filePaths: string[] = []): string {
    if (this.layers.length === 0 && this.conditionalRules.length === 0) return "";

    const parts: string[] = ["## Project Memory\n"];

    // Always-loaded layers
    for (const layer of this.layers) {
      parts.push(`### ${layer.scope}: ${layer.path}\n${layer.content}\n`);
    }

    // Conditional rules (if matching files provided)
    for (const rule of this.conditionalRules) {
      if (filePaths.length === 0) {
        // No specific files — include all conditional rules
        parts.push(`### conditional: ${rule.path}\n${rule.content}\n`);
      } else if (rule.globs) {
        const matches = filePaths.some((fp) =>
          rule.globs!.some((glob) => this.matchGlob(fp, glob))
        );
        if (matches) {
          parts.push(`### conditional: ${rule.path} (matches: ${rule.globs.join(", ")})\n${rule.content}\n`);
        }
      }
    }

    return parts.join("\n");
  }

  /**
   * Simple glob matching (supports *, **, ?).
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regex = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "<<GLOBSTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<GLOBSTAR>>/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`).test(filePath.replace(/\\/g, "/"));
  }

  async learn(fact: string): Promise<void> {
    const memoryPath = join(this.projectRoot, "MEMORY.md");
    try {
      let existing = "";
      try { existing = await readFile(memoryPath, "utf-8"); } catch { /* first time */ }

      const timestamp = new Date().toISOString().split("T")[0];
      const entry = `- [${timestamp}] ${fact}`;
      const updated = existing ? `${existing}\n${entry}` : `# Project Memory\n\n${entry}\n`;

      await writeFile(memoryPath, updated, "utf-8");
    } catch (err: unknown) {
      console.error(`Failed to save memory: ${err}`);
    }
  }

  getLayers(): MemoryLayer[] {
    return [...this.layers, ...this.conditionalRules];
  }

  getConditionalRules(): MemoryLayer[] {
    return [...this.conditionalRules];
  }
}
