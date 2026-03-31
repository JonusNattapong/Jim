/**
 * Thinking Mode Configuration
 * 
 * Inspired by Claude Code's thinking system that provides structured control
 * over reasoning depth. Supports adaptive, enabled with budget, or disabled modes.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Thinking mode configuration
 */
export type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens: number }
  | { type: "disabled" };

/**
 * Thinking trigger detected in user input
 */
export interface ThinkingTrigger {
  word: string;
  start: number;
  end: number;
}

/**
 * Thinking state during execution
 */
export interface ThinkingState {
  isActive: boolean;
  config: ThinkingConfig;
  triggeredBy?: ThinkingTrigger;
  tokensUsed: number;
  tokensRemaining: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Keywords that trigger enhanced thinking
 */
const THINKING_TRIGGERS = [
  "ultrathink",
  "think harder",
  "think deeply",
  "think step by step",
  "reason carefully",
  "analyze thoroughly",
] as const;

/**
 * Token budgets for different thinking modes
 */
const THINKING_BUDGETS = {
  minimal: 2_000,
  standard: 5_000,
  deep: 10_000,
  ultrathink: 20_000,
} as const;

/**
 * Reserved tokens for summary generation
 */
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000;

// ============================================================================
// Trigger Detection
// ============================================================================

/**
 * Check if text contains an ultrathink keyword
 */
export function hasUltrathinkKeyword(text: string): boolean {
  return /\bultrathink\b/i.test(text);
}

/**
 * Find all thinking trigger positions in text
 */
export function findThinkingTriggerPositions(text: string): ThinkingTrigger[] {
  const triggers: ThinkingTrigger[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of THINKING_TRIGGERS) {
    let startIndex = 0;
    while (true) {
      const index = lowerText.indexOf(keyword, startIndex);
      if (index === -1) break;

      triggers.push({
        word: text.slice(index, index + keyword.length),
        start: index,
        end: index + keyword.length,
      });

      startIndex = index + keyword.length;
    }
  }

  return triggers.sort((a, b) => a.start - b.start);
}

/**
 * Get the strongest thinking trigger from text
 */
export function getStrongestTrigger(text: string): ThinkingTrigger | null {
  const triggers = findThinkingTriggerPositions(text);
  if (triggers.length === 0) return null;

  // Ultrathink is the strongest
  const ultrathink = triggers.find((t) =>
    t.word.toLowerCase() === "ultrathink"
  );
  if (ultrathink) return ultrathink;

  // Otherwise return first trigger
  return triggers[0];
}

// ============================================================================
// Budget Calculation
// ============================================================================

/**
 * Calculate token budget for a thinking config
 */
export function calculateThinkingBudget(config: ThinkingConfig): number {
  switch (config.type) {
    case "disabled":
      return 0;
    case "enabled":
      return config.budgetTokens;
    case "adaptive":
      // Adaptive uses a standard budget
      return THINKING_BUDGETS.standard;
  }
}

/**
 * Determine thinking config from user input
 */
export function inferThinkingConfig(
  text: string,
  defaultConfig: ThinkingConfig = { type: "adaptive" }
): ThinkingConfig {
  const triggers = findThinkingTriggerPositions(text);

  if (triggers.length === 0) {
    return defaultConfig;
  }

  // Check for ultrathink keyword
  if (hasUltrathinkKeyword(text)) {
    return { type: "enabled", budgetTokens: THINKING_BUDGETS.ultrathink };
  }

  // Check for other strong triggers
  const hasDeepTrigger = triggers.some((t) =>
    t.word.toLowerCase().includes("deeply") ||
    t.word.toLowerCase().includes("thoroughly")
  );
  if (hasDeepTrigger) {
    return { type: "enabled", budgetTokens: THINKING_BUDGETS.deep };
  }

  // Standard triggers
  return { type: "enabled", budgetTokens: THINKING_BUDGETS.standard };
}

// ============================================================================
// Thinking State Management
// ============================================================================

/**
 * Create initial thinking state
 */
export function createThinkingState(config: ThinkingConfig): ThinkingState {
  const budget = calculateThinkingBudget(config);
  return {
    isActive: config.type !== "disabled",
    config,
    tokensUsed: 0,
    tokensRemaining: budget,
  };
}

/**
 * Update thinking state after token usage
 */
export function updateThinkingState(
  state: ThinkingState,
  tokensUsed: number
): ThinkingState {
  return {
    ...state,
    tokensUsed: state.tokensUsed + tokensUsed,
    tokensRemaining: Math.max(0, state.tokensRemaining - tokensUsed),
  };
}

/**
 * Check if thinking budget is exhausted
 */
export function isThinkingBudgetExhausted(state: ThinkingState): boolean {
  return state.tokensRemaining <= 0;
}

/**
 * Check if thinking should continue
 */
export function shouldContinueThinking(state: ThinkingState): boolean {
  if (!state.isActive) return false;
  if (state.config.type === "disabled") return false;
  return state.tokensRemaining > 0;
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate thinking system prompt based on config
 */
export function generateThinkingPrompt(config: ThinkingConfig): string {
  switch (config.type) {
    case "disabled":
      return "";

    case "adaptive":
      return `You may use step-by-step thinking to work through complex problems. Show your reasoning when it helps clarify your approach.`;

    case "enabled":
      return `Use detailed step-by-step reasoning. You have a budget of ${config.budgetTokens} tokens for thinking. Work through the problem systematically:
1. Understand the request
2. Break down the problem
3. Consider approaches
4. Execute the best approach
5. Verify the result`;

    default:
      return "";
  }
}

/**
 * Generate enhanced prompt when ultrathink is triggered
 */
export function generateUltrathinkPrompt(): string {
  return `ULTRATHINK MODE ACTIVATED

Take your time to deeply analyze this problem. Use extensive step-by-step reasoning:
1. Carefully read and understand every aspect of the request
2. Break down the problem into its fundamental components
3. Consider ALL possible approaches and their trade-offs
4. Choose the best approach based on the specific context
5. Implement thoroughly with attention to edge cases
6. Verify your solution against the original requirements

Do not rush. Quality of reasoning is more important than speed.`;
}

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * Predefined thinking configurations
 */
export const ThinkingPresets = {
  disabled: { type: "disabled" } as ThinkingConfig,
  adaptive: { type: "adaptive" } as ThinkingConfig,
  minimal: { type: "enabled", budgetTokens: THINKING_BUDGETS.minimal } as ThinkingConfig,
  standard: { type: "enabled", budgetTokens: THINKING_BUDGETS.standard } as ThinkingConfig,
  deep: { type: "enabled", budgetTokens: THINKING_BUDGETS.deep } as ThinkingConfig,
  ultrathink: { type: "enabled", budgetTokens: THINKING_BUDGETS.ultrathink } as ThinkingConfig,
} as const;

// ============================================================================
// Exports
// ============================================================================

export const ThinkingConfig = {
  hasUltrathinkKeyword,
  findThinkingTriggerPositions,
  getStrongestTrigger,
  calculateThinkingBudget,
  inferThinkingConfig,
  createThinkingState,
  updateThinkingState,
  isThinkingBudgetExhausted,
  shouldContinueThinking,
  generateThinkingPrompt,
  generateUltrathinkPrompt,
  ThinkingPresets,
  THINKING_BUDGETS,
} as const;