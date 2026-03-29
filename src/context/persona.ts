import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { childLogger } from "../utils/logger.js";

export interface UserPersona {
  codingStyle: string[];
  preferences: string[];
  toolUsagePatterns: Record<string, number>;
  communicationStyle: string;
  knownConcepts: string[];
  lastUpdated: string;
}

export class UserPersonaManager {
  private personaFilePath: string;
  private persona: UserPersona;
  private log = childLogger({ component: "persona" });

  constructor(projectRoot: string) {
    this.personaFilePath = join(projectRoot, ".jim", "user_persona.json");
    this.persona = {
      codingStyle: [],
      preferences: [],
      toolUsagePatterns: {},
      communicationStyle: "Direct and technical",
      knownConcepts: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  async load(): Promise<void> {
    try {
      const data = await readFile(this.personaFilePath, "utf-8");
      this.persona = JSON.parse(data);
    } catch {
      this.log.debug("No existing persona found, starting fresh.");
    }
  }

  async save(): Promise<void> {
    try {
      await mkdir(join(this.personaFilePath, ".."), { recursive: true });
      await writeFile(this.personaFilePath, JSON.stringify(this.persona, null, 2), "utf-8");
    } catch (err: unknown) {
      this.log.error({ err }, "Failed to save persona");
    }
  }

  getPersona(): UserPersona {
    return this.persona;
  }

  updateFromReflection(newTraits: Partial<UserPersona>): void {
    if (newTraits.codingStyle) {
      this.persona.codingStyle = [...new Set([...this.persona.codingStyle, ...newTraits.codingStyle])];
    }
    if (newTraits.preferences) {
      this.persona.preferences = [...new Set([...this.persona.preferences, ...newTraits.preferences])];
    }
    if (newTraits.communicationStyle) {
      this.persona.communicationStyle = newTraits.communicationStyle;
    }
    if (newTraits.knownConcepts) {
      this.persona.knownConcepts = [...new Set([...this.persona.knownConcepts, ...newTraits.knownConcepts])];
    }
    this.persona.lastUpdated = new Date().toISOString();
  }

  recordToolUsage(toolName: string): void {
    this.persona.toolUsagePatterns[toolName] = (this.persona.toolUsagePatterns[toolName] ?? 0) + 1;
  }

  buildPromptFragment(): string {
    if (this.persona.codingStyle.length === 0 && this.persona.preferences.length === 0) return "";

    return `
## 👤 USER MODEL (Learned Preferences)
Your shared history with the user has revealed the following:
- **Coding Style**: ${this.persona.codingStyle.join(", ") || "Unknown yet"}
- **Preferences**: ${this.persona.preferences.join(", ") || "None recorded"}
- **Communication**: ${this.persona.communicationStyle}
- **Concepts you know the user understands**: ${this.persona.knownConcepts.join(", ") || "General"}

Use this model to tailor your suggestions and code to the user's preferred patterns.
`;
  }
}
