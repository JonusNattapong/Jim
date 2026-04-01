/**
 * System Prompt Builder with Cache Boundary Support
 * 
 * Implements the Static/Dynamic boundary pattern from ClaudeCode:
 * - Static sections are cached across the session
 * - Dynamic sections change every turn
 * - Boundary marker: __SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
 */

import {
  buildStaticSystemPrompt,
  buildCompleteSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  type SystemPromptBuildOptions,
} from "../constants/prompts.js";
import { buildOutputStylePrompt, type OutputStyleConfig } from "../constants/outputStyles.js";

/**
 * Priority system for system prompts
 * Highest → Lowest:
 * 0. Override system prompt (replaces all — e.g., loop mode)
 * 1. Coordinator system prompt (multi-agent mode)
 * 2. Agent system prompt (custom agent definition)
 *    - In proactive mode: APPEND instead of REPLACE
 * 3. Custom system prompt (--system-prompt flag)
 * 4. Default system prompt (standard)
 * Plus: appendSystemPrompt always appended
 */
export type SystemPromptPriority =
  | "override"      // 0: replaces everything
  | "coordinator"   // 1: multi-agent orchestration
  | "agent"          // 2: subagent/custom agent
  | "custom"         // 3: user-provided --system-prompt
  | "default";       // 4: standard system prompt

export interface SystemPromptLayer {
  priority: SystemPromptPriority;
  content: string;
  mode?: "replace" | "append";
}

/**
 * System prompt builder state
 */
export class SystemPromptBuilder {
  private layers: SystemPromptLayer[] = [];
  private staticCache: string | null = null;
  private staticHash: string | null = null;
  private outputStyle: OutputStyleConfig | null = null;
  private modelId: string | null = null;

  /**
   * Set the output style configuration
   */
  setOutputStyle(style: OutputStyleConfig | null): void {
    this.outputStyle = style;
    this.invalidateCache();
  }

  /**
   * Set the model ID (for knowledge cutoff)
   */
  setModelId(modelId: string | null): void {
    this.modelId = modelId;
    this.invalidateCache();
  }

  /**
   * Add a system prompt layer
   */
  addLayer(layer: SystemPromptLayer): void {
    this.layers.push(layer);
    // Sort by priority (override is highest, default is lowest)
    const priorityOrder: Record<SystemPromptPriority, number> = {
      override: 0,
      coordinator: 1,
      agent: 2,
      custom: 3,
      default: 4,
    };
    this.layers.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Remove all layers of a specific priority
   */
  removeLayers(priority: SystemPromptPriority): void {
    this.layers = this.layers.filter((l) => l.priority !== priority);
  }

  /**
   * Clear all layers
   */
  clearLayers(): void {
    this.layers = [];
  }

  /**
   * Invalidate the static cache
   */
  private invalidateCache(): void {
    this.staticCache = null;
    this.staticHash = null;
  }

  /**
   * Build the static section (cached across session)
   */
  buildStaticSection(): string {
    if (this.staticCache) {
      return this.staticCache;
    }

    const basePrompt = buildStaticSystemPrompt(this.outputStyle, this.modelId ?? undefined);
    
    // Apply layers that should be part of static section
    // By default, only "default" and "custom" are in static section
    const staticLayers = this.layers.filter(
      (l) => l.priority === "default" || l.priority === "custom"
    );

    if (staticLayers.length === 0) {
      this.staticCache = basePrompt;
      return this.staticCache;
    }

    // Build static section with layers
    const sections: string[] = [basePrompt];
    
    for (const layer of staticLayers) {
      if (layer.mode === "append" || !layer.mode) {
        sections.push(layer.content);
      } else {
        // replace mode - this is unusual for static, but supported
        sections.length = 0;
        sections.push(layer.content);
      }
    }

    this.staticCache = sections.join("\n\n");
    return this.staticCache;
  }

  /**
   * Build the dynamic section (changes every turn)
   */
  buildDynamicSection(options: Omit<SystemPromptBuildOptions, "outputStyleConfig" | "modelId">): string {
    const sections: string[] = [];

    // Apply dynamic layers (coordinator, agent, override)
    const dynamicLayers = this.layers.filter(
      (l) => l.priority === "coordinator" || l.priority === "agent" || l.priority === "override"
    );

    for (const layer of dynamicLayers) {
      if (layer.priority === "override") {
        // Override replaces everything - but we're in dynamic section
        // so we just prepend it as highest priority
        sections.unshift(layer.content);
      } else if (layer.mode === "append") {
        sections.push(layer.content);
      } else {
        sections.push(layer.content);
      }
    }

    // Add context-dependent sections
    if (options.memoryContext) {
      sections.push(`## Memory\n\n${options.memoryContext}`);
    }

    if (options.personaContext) {
      sections.push(`## User Persona\n\n${options.personaContext}`);
    }

    if (options.skillsContext) {
      sections.push(`## Skills\n\n${options.skillsContext}`);
    }

    if (options.repoMap) {
      sections.push(`## Repository Map\n\n\`\`\`\n${options.repoMap}\n\`\`\``);
    }

    if (options.sessionSpecific) {
      sections.push(`## Session Context\n\n${options.sessionSpecific}`);
    }

    if (options.environmentInfo) {
      sections.push(`## Environment\n\n${options.environmentInfo}`);
    }

    if (options.languagePreference) {
      sections.push(`## Language Preference\n\n${options.languagePreference}`);
    }

    if (options.mcpInstructions) {
      sections.push(`## MCP Instructions\n\n${options.mcpInstructions}`);
    }

    if (options.briefMode) {
      sections.push(`## Brief Mode\n\nYou are in brief mode. Be extremely concise. Skip explanations unless asked.`);
    }

    return sections.join("\n\n");
  }

  /**
   * Build complete system prompt with boundary marker
   */
  build(options: Omit<SystemPromptBuildOptions, "outputStyleConfig" | "modelId">): string {
    const staticSection = this.buildStaticSection();
    const dynamicSection = this.buildDynamicSection(options);

    // Check for override layer - it replaces everything
    const hasOverride = this.layers.some((l) => l.priority === "override");
    if (hasOverride) {
      // Override means we don't use the boundary structure
      return [staticSection, dynamicSection].filter(Boolean).join("\n\n");
    }

    return [
      staticSection,
      "",
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      "",
      dynamicSection,
    ].join("\n");
  }

  /**
   * Build just the static section for caching purposes
   */
  buildForCache(): { static: string; boundary: string } {
    return {
      static: this.buildStaticSection(),
      boundary: SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    };
  }

  /**
   * Get the current output style
   */
  getOutputStyle(): OutputStyleConfig | null {
    return this.outputStyle;
  }

  /**
   * Get the current model ID
   */
  getModelId(): string | null {
    return this.modelId;
  }
}

/**
 * Create a new system prompt builder
 */
export function createSystemPromptBuilder(
  modelId?: string,
  outputStyle?: OutputStyleConfig
): SystemPromptBuilder {
  const builder = new SystemPromptBuilder();
  if (modelId) builder.setModelId(modelId);
  if (outputStyle) builder.setOutputStyle(outputStyle);
  return builder;
}

/**
 * Simple function to build system prompt with all options
 */
export function buildSystemPrompt(
  options: SystemPromptBuildOptions & {
    customLayers?: SystemPromptLayer[];
  }
): string {
  const builder = createSystemPromptBuilder(options.modelId, options.outputStyleConfig ?? null);
  
  if (options.customLayers) {
    for (const layer of options.customLayers) {
      builder.addLayer(layer);
    }
  }

  const { outputStyleConfig, modelId, customLayers, ...rest } = options;
  return builder.build(rest);
}
