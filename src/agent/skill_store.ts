import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { childLogger } from "../utils/logger.js";

export interface Skill {
  name: string;
  description: string;
  steps: string[];
  successCount: number;
  lastUsed: string;
  category: "dev" | "test" | "ops" | "mcp" | "other";
}

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
      const files = await readdir(this.skillsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const data = await readFile(join(this.skillsDir, file), "utf-8");
        const skill = JSON.parse(data) as Skill;
        this.skills.set(skill.name, skill);
      }
      this.log.info({ count: this.skills.size }, "Skills loaded");
    } catch {
      this.log.debug("No existing skills found.");
    }
  }

  async saveSkill(skill: Skill): Promise<void> {
    if (!skill?.name) return;
    const filename = `${skill.name.toLowerCase().replace(/\s+/g, "_")}.json`;
    await writeFile(join(this.skillsDir, filename), JSON.stringify(skill, null, 2), "utf-8");
    this.skills.set(skill.name, skill);
    this.log.info({ skillName: skill.name }, "Skill saved/updated");
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  findSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  buildPromptFragment(): string {
    if (this.skills.size === 0) return "";

    const skillList = Array.from(this.skills.values())
      .map(s => `- **${s.name}**: ${s.description} (Used ${s.successCount} times)`)
      .join("\n");

    return `
## 🛠️ REPERTOIRE OF LEARNED SKILLS
You have previously mastered the following complex workflows. Use them as blueprints when appropriate:
${skillList}

If a task matches any of these, prefer following the steps recorded in your skills.
`;
  }

  recordSkillSuccess(name: string): void {
    const skill = this.skills.get(name);
    if (skill) {
      skill.successCount++;
      skill.lastUsed = new Date().toISOString();
      this.saveSkill(skill);
    }
  }
}
