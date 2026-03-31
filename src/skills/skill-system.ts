/**
 * Skills System - Reusable Workflow Framework
 * 
 * Inspired by Claude Code's skills system that allows defining
 * reusable workflows as markdown files with tool restrictions.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Skill definition
 */
export interface SkillDefinition {
  /** Skill name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Description of what this skill does */
  description: string;
  /** When to use this skill */
  whenToUse?: string;
  /** Aliases for invoking this skill */
  aliases?: string[];
  /** Argument hint for the skill */
  argumentHint?: string;
  /** Allowed tools (restricts which tools the skill can use) */
  allowedTools?: string[];
  /** Model to use for this skill */
  model?: string;
  /** Whether this skill can be invoked by the user */
  userInvocable?: boolean;
  /** Whether this skill is enabled */
  isEnabled?: boolean | (() => boolean);
  /** Skill content (markdown instructions) */
  content: string;
  /** Source directory */
  source?: string;
}

/**
 * Skill source types
 */
export type SkillSource = "builtin" | "user" | "project" | "managed";

/**
 * Skill with metadata
 */
export interface Skill {
  definition: SkillDefinition;
  source: SkillSource;
  filePath: string;
  loadedAt: number;
}

/**
 * Skill execution context
 */
export interface SkillExecutionContext {
  skill: Skill;
  args: string[];
  sessionId: string;
  allowedTools: string[];
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  toolCalls: number;
  durationMs: number;
}

// ============================================================================
// Skill Manager
// ============================================================================

/**
 * Manages skill loading, discovery, and execution
 */
export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private searchPaths: string[] = [];

  constructor(searchPaths: string[] = []) {
    this.searchPaths = searchPaths;
  }

  /**
   * Add a skill search path
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
    }
  }

  /**
   * Register a skill
   */
  registerSkill(
    definition: SkillDefinition,
    source: SkillSource,
    filePath: string
  ): void {
    const skill: Skill = {
      definition,
      source,
      filePath,
      loadedAt: Date.now(),
    };

    this.skills.set(definition.name, skill);

    // Also register aliases
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.skills.set(alias, skill);
      }
    }
  }

  /**
   * Load skills from a directory (simulated)
   */
  async loadSkillsFromDirectory(
    dirPath: string,
    source: SkillSource
  ): Promise<number> {
    // In production, this would scan directory for .md files
    // and parse frontmatter for skill definitions
    return 0;
  }

  /**
   * Get a skill by name or alias
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    // Deduplicate by name (aliases point to same skill)
    const seen = new Set<string>();
    const unique: Skill[] = [];
    for (const skill of this.skills.values()) {
      if (!seen.has(skill.definition.name)) {
        seen.add(skill.definition.name);
        unique.push(skill);
      }
    }
    return unique;
  }

  /**
   * Get enabled skills
   */
  getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter((s) => {
      const enabled = s.definition.isEnabled;
      if (typeof enabled === "function") return enabled();
      return enabled !== false;
    });
  }

  /**
   * Get user-invocable skills
   */
  getUserInvocableSkills(): Skill[] {
    return this.getEnabledSkills().filter((s) => s.definition.userInvocable !== false);
  }

  /**
   * Check if a skill is enabled
   */
  isSkillEnabled(name: string): boolean {
    const skill = this.getSkill(name);
    if (!skill) return false;

    const enabled = skill.definition.isEnabled;
    if (typeof enabled === "function") return enabled();
    return enabled !== false;
  }

  /**
   * Get skill system prompt
   */
  getSkillPrompt(name: string, args: string[] = []): string | null {
    const skill = this.getSkill(name);
    if (!skill) return null;

    let prompt = skill.definition.content;

    // Replace argument placeholders
    if (args.length > 0) {
      prompt = prompt.replace(/\$ARGUMENTS/g, args.join(" "));
      for (let i = 0; i < args.length; i++) {
        prompt = prompt.replace(new RegExp(`\\$${i + 1}`, "g"), args[i]);
      }
    }

    return prompt;
  }

  /**
   * Get allowed tools for a skill
   */
  getAllowedTools(name: string): string[] | null {
    const skill = this.getSkill(name);
    return skill?.definition.allowedTools ?? null;
  }

  /**
   * Search skills by keyword
   */
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getEnabledSkills().filter((s) => {
      const def = s.definition;
      return (
        def.name.toLowerCase().includes(lowerQuery) ||
        def.description.toLowerCase().includes(lowerQuery) ||
        def.whenToUse?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    totalSkills: number;
    enabledSkills: number;
    bySource: Record<SkillSource, number>;
  } {
    const all = this.getAllSkills();
    const bySource: Record<SkillSource, number> = {
      builtin: 0,
      user: 0,
      project: 0,
      managed: 0,
    };

    for (const skill of all) {
      bySource[skill.source]++;
    }

    return {
      totalSkills: all.length,
      enabledSkills: this.getEnabledSkills().length,
      bySource,
    };
  }

  /**
   * Remove a skill
   */
  removeSkill(name: string): boolean {
    const skill = this.getSkill(name);
    if (!skill) return false;

    this.skills.delete(name);

    // Remove aliases
    if (skill.definition.aliases) {
      for (const alias of skill.definition.aliases) {
        this.skills.delete(alias);
      }
    }

    return true;
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
  }
}

// ============================================================================
// Built-in Skills
// ============================================================================

/**
 * Example built-in skills
 */
export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    name: "code-review",
    description: "Review code for quality, security, and best practices",
    whenToUse: "When the user asks to review code or a pull request",
    aliases: ["review"],
    allowedTools: ["read_file", "grep", "glob"],
    userInvocable: true,
    content: `You are a code reviewer. Analyze the provided code for:
1. Code quality and readability
2. Potential bugs or issues
3. Security vulnerabilities
4. Performance concerns
5. Best practices

Provide actionable feedback with specific line references.`,
  },
  {
    name: "explain-code",
    description: "Explain how a piece of code works",
    whenToUse: "When the user asks to explain code",
    aliases: ["explain"],
    allowedTools: ["read_file"],
    userInvocable: true,
    content: `Explain the provided code clearly:
1. What does it do?
2. How does it work?
3. Key concepts used
4. Any potential issues

Use simple language and examples where helpful.`,
  },
  {
    name: "write-tests",
    description: "Write unit tests for code",
    whenToUse: "When the user asks to write tests",
    aliases: ["test"],
    allowedTools: ["read_file", "write_file", "grep"],
    userInvocable: true,
    content: `Write comprehensive unit tests for the provided code:
1. Test happy paths
2. Test edge cases
3. Test error conditions
4. Use descriptive test names

Follow the project's testing conventions.`,
  },
];

// ============================================================================
// Exports
// ============================================================================

export const Skills = {
  SkillManager,
  BUILTIN_SKILLS,
} as const;