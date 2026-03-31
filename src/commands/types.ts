export interface CommandDefinition {
  name: string;
  description: string;
  aliases: string[];
  category: string;
  usage: string;
  examples: string[];
  handler: CommandHandler;
}

export interface CommandContext {
  projectRoot?: string;
  sessionId?: string;
  abortSignal?: AbortSignal;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

export type CommandHandler = (args: string[], context?: CommandContext) => Promise<CommandResult>;
export type CommandCategory = "git" | "context" | "session" | "config" | "dev" | "tools" | "agent" | "general";
