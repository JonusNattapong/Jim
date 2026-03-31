import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMProvider } from "./provider.js";
import { UserPersonaManager } from "../context/persona.js";
import { SkillStore, Skill } from "./skill_store.js";
import { childLogger } from "../utils/logger.js";

export class ConsolidationEngine {
  private provider: LLMProvider;
  private model: string;
  private personaManager: UserPersonaManager;
  private skillStore: SkillStore;
  private log = childLogger({ component: "consolidation" });

  constructor(provider: LLMProvider, model: string, personaManager: UserPersonaManager, skillStore: SkillStore) {
    this.provider = provider;
    this.model = model;
    this.personaManager = personaManager;
    this.skillStore = skillStore;
  }

  async consolidate(messages: ChatCompletionMessageParam[]): Promise<void> {
    const sessionHistory = messages
      .map((msg) => `[${msg.role}] ${typeof msg.content === "string" ? msg.content.slice(0, 500) : "Complex content"}`)
      .join("\n");

    this.log.info("Starting session consolidation...");

    await Promise.all([
      this.reflectOnUser(sessionHistory),
      this.extractSkills(sessionHistory),
    ]);

    await this.personaManager.save();
  }

  private async reflectOnUser(history: string): Promise<void> {
    const prompt = `Analyze this conversation history to extract the user's coding style, preferences, and understood concepts. 
    
    Current Persona: ${JSON.stringify(this.personaManager.getPersona())}
    
    Conversation History:
    ${history}
    
    Update the persona with NEW insights only. Respond with a JSON object containing:
    {
      "codingStyle": string[],
      "preferences": string[],
      "communicationStyle": string,
      "knownConcepts": string[]
    }`;

    try {
      const result = await this.provider.complete(
        [
          { role: "system", content: "You are a user-modeling expert. Respond inside ONLY valid JSON tags." },
          { role: "user", content: prompt },
        ],
        [],
        { model: this.model, maxTokens: 800, temperature: 0 },
      );

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         const updates = JSON.parse(jsonMatch[0]);
         this.personaManager.updateFromReflection(updates);
         this.log.info("User persona updated from session.");
      }
    } catch (err: unknown) {
      this.log.warn({ err }, "Failed to reflect on user persona");
    }
  }

  private async extractSkills(history: string): Promise<void> {
    const prompt = `Look for a complex, multi-step task that was SUCCESSFULLY completed in this conversation. 
    If a reusable workflow exists, extract it as a 'Skill'.
    
    Conversation History:
    ${history}
    
    Return ONLY a JSON list of new skills or null if none worth extracting:
    [
      {
        "name": "Short descriptive name",
        "description": "What this skill does",
        "steps": ["Step 1", "Step 2", ...],
        "category": "dev" | "test" | "ops" | "mcp" | "other"
      }
    ]`;

    try {
      const result = await this.provider.complete(
        [
          { role: "system", content: "You are a workflow extraction expert. Respond ONLY with valid JSON." },
          { role: "user", content: prompt },
        ],
        [],
        { model: this.model, maxTokens: 1000, temperature: 0 },
      );

      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        const skills = Array.isArray(parsed) ? parsed : [];
        for (const skill of skills) {
          if (!this.isValidSkill(skill)) continue;
          const existing = this.skillStore.findSkill(skill.name);
          if (!existing) {
             const newSkill: Skill = {
               ...skill,
               successCount: 1,
               lastUsed: new Date().toISOString()
             };
             await this.skillStore.saveSkill(newSkill);
             this.log.info({ skillName: skill.name }, "New skill extracted from session.");
          } else {
             this.skillStore.recordSkillSuccess(skill.name);
          }
        }
      }
    } catch (err: unknown) {
      this.log.warn({ err }, "Failed to extract skills from session");
    }
  }

  private isValidSkill(skill: unknown): skill is Omit<Skill, "successCount" | "lastUsed"> & Partial<Pick<Skill, "successCount" | "lastUsed">> {
    if (!skill || typeof skill !== "object") return false;
    const candidate = skill as Record<string, unknown>;
    return typeof candidate.name === "string"
      && typeof candidate.description === "string"
      && Array.isArray(candidate.steps)
      && typeof candidate.category === "string";
  }
}
