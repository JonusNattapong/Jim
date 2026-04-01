// Command type: local (sync), jsx (React UI), or external
export type CommandType = "local" | "local-jsx" | "external";

// Command result for text commands
export interface CommandResult {
  type: "text" | "jsx" | "error";
  value: string | any;
}

// Local command handler
export type LocalCommandCall = (
  args: string,
  context: CommandContext
) => Promise<CommandResult>;

// JSX command handler (React component)
export type LocalJSXCommandCall = (
  onDone: () => void,
  context: CommandContext
) => Promise<any>;

// Enhanced command definition with lazy loading support
export interface EnhancedCommandDefinition {
  type: CommandType;
  name: string;
  description: string;
  argumentHint?: string;
  category: string;
  isEnabled?: () => boolean | Promise<boolean>;
  isHidden?: boolean;
  supportsNonInteractive?: boolean;
  immediate?: boolean;
  load?: () => Promise<{ call: LocalCommandCall | LocalJSXCommandCall }>;
  handler?: (args: string[], context: CommandContext) => Promise<string>;
}

// Keep old interface for backward compatibility
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  category: string;
  usage: string;
  examples?: string[];
  handler: (args: string[], context: CommandContext) => Promise<string>;
  dangerous?: boolean;
}

export interface CommandContext {
  agent: any;
  projectRoot?: string;
  sessionId?: string;
  abortSignal?: AbortSignal;
}

export type CommandCategory =
  | "git"
  | "context"
  | "session"
  | "config"
  | "dev"
  | "tools"
  | "agent"
  | "model"
  | "mcp"
  | "skills"
  | "memory"
  | "general";
