import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { childLogger } from "../utils/logger.js";

export interface Skill {
  name: string;
  description: string;
  whenToUse?: string;
  allowedTools?: string[];
  content: string; // The markdown content
  source: "user" | "project" | "builtin";
  filePath: string;
}

/**
 * SkillStore (Antigravity Edition)
 * Manages skills stored as .jim/skills/<name>/SKILL.md
 */
export class SkillStore {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();
  private log = childLogger({ component: "skill-store" });

  constructor(projectRoot: string) {
    this.skillsDir = join(projectRoot, ".jim", "skills");
  }

  async load(): Promise<void> {
    try {
      await mkdir(this.skillsDir, { recursive: true });
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      
      this.skills.clear();

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const skillName = entry.name;
        const skillFile = join(this.skillsDir, skillName, "SKILL.md");
        
        try {
          const content = await readFile(skillFile, "utf-8");
          const skill = this.parseSkillMarkdown(skillName, content, skillFile);
          this.skills.set(skill.name.toLowerCase(), skill);
        } catch (e) {
          // Skip if SKILL.md doesn't exist
        }
      }
      this.log.info({ count: this.skills.size }, "Antigravity Skills loaded");
    } catch (e) {
      this.log.error({ error: e }, "Failed to load skills");
    }
  }

  private parseSkillMarkdown(name: string, content: string, filePath: string): Skill {
    // Simple frontmatter parser (--- ... ---)
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    let description = "No description provided";
    let whenToUse = "";
    let allowedTools: string[] = [];
    let body = content;

    if (match) {
      const yamlStr = match[1];
      body = content.replace(frontmatterRegex, "").trim();
      
      // Basic YAML-lite parsing
      yamlStr.split("\n").forEach(line => {
        const [key, ...vals] = line.split(":");
        const val = vals.join(":").trim();
        if (key.trim() === "description") description = val;
        if (key.trim() === "when_to_use") whenToUse = val;
        if (key.trim() === "allowed_tools") {
          allowedTools = val.replace(/[\[\]]/g, "").split(",").map(s => s.trim()).filter(Boolean);
        }
      });
    }

    return {
      name,
      description,
      whenToUse,
      allowedTools,
      content: body,
      source: "project",
      filePath
    };
  }

  async saveSkill(name: string, content: string, metadata: Partial<Skill>): Promise<void> {
    const dir = join(this.skillsDir, name.toLowerCase());
    await mkdir(dir, { recursive: true });
    
    const frontmatter = `---
description: ${metadata.description || "Updated via Jim"}
when_to_use: ${metadata.whenToUse || ""}
allowed_tools: [${(metadata.allowedTools || []).join(", ")}]
---

${content.trim()}`;

    await writeFile(join(dir, "SKILL.md"), frontmatter, "utf-8");
    await this.load(); // Refresh
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  findSkill(name: string): Skill | undefined {
    return this.skills.get(name.toLowerCase());
  }

  buildPromptFragment(): string {
    if (this.skills.size === 0) return "";

    const skillList = Array.from(this.skills.values())
      .map(s => `- **${s.name}**: ${s.description}${s.whenToUse ? ` (Use when: ${s.whenToUse})` : ""}`)
      .join("\n");

    return `
## 🧠 MASTERED SKILLS (.jim/skills)
You have mastered the following professional workflows. When a task matches the 'when_to_use' criteria, you MUST follow the instructions in that skill's markdown.

${skillList}

To use a skill, you conceptually "load" its instructions and execute the task accordingly.
`;
  }
}
