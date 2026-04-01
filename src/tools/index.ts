export { ToolRegistry } from "./registry.js";
export type { ToolDefinition, ToolHandler, ToolResult, ToolCall, ToolContext } from "./types.js";

// Tool Enhancement System exports
export {
  getToolPrompt,
  buildToolPromptsSection,
  getToolTips,
  getCommonMistakes,
  TOOL_PROMPTS,
} from "./prompts/index.js";
export type { ToolPrompt } from "./prompts/index.js";

export {
  getCommandSemantics,
  interpretExitCode,
  COMMAND_SEMANTICS,
} from "./semantics/index.js";
export type { CommandSemantic, ExitCodeSemantics } from "./semantics/index.js";

export {
  validateCommand,
  requiresApproval,
  validateFilePath,
  validateRegexPattern,
  validateArguments,
  sanitizeCommandForLogging,
} from "./validation/index.js";
export type { ValidationResult, CommandValidationRules } from "./validation/index.js";

export {
  TOOL_ERRORS,
  getToolError,
  formatErrorWithSuggestion,
} from "./errors/index.js";
export type { ToolError } from "./errors/index.js";
