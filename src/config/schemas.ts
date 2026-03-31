import { z } from "zod";

export const AgentConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  baseUrl: z.string().url("Base URL must be a valid URL"),
  model: z.string().min(1, "Model is required"),
  maxTurns: z.number().int().min(1).max(100).default(30),
  maxToolOutput: z.number().int().min(100).max(100_000).default(5000),
  projectRoot: z.string().min(1),
  permissionMode: z.enum(["plan", "edit", "ask"]).default("ask"),
  streaming: z.boolean().default(false),
  api: z.enum(["auto", "openai", "openai-compatible", "chat-completions", "responses"]).default("auto"),
  providerPreset: z.string().optional(),
});

export const MCPServerConfigSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  maxReconnects: z.number().int().min(0).max(10).default(3),
  reconnectDelay: z.number().int().min(500).max(30_000).default(2000),
});

export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema).optional(),
  mcpServers: z.record(z.string(), MCPServerConfigSchema.omit({ name: true })).optional(),
});

export const HookDefinitionSchema = z.object({
  event: z.enum(["PreToolUse", "PostToolUse", "SessionStart", "SessionEnd", "AgentTurn", "PreSession", "PostSession", "OnCheckpoint"]),
  toolPattern: z.string().optional(),
  command: z.string().min(1),
  description: z.string().optional(),
});

export const TrustedFolderConfigSchema = z.object({
  paths: z.array(z.string()).default([]),
  enforce: z.boolean().default(false),
});

export type ValidatedAgentConfig = z.infer<typeof AgentConfigSchema>;
export type ValidatedMCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type ValidatedMCPConfig = z.infer<typeof MCPConfigSchema>;
export type ValidatedHookDefinition = z.infer<typeof HookDefinitionSchema>;
export type ValidatedTrustedFolderConfig = z.infer<typeof TrustedFolderConfigSchema>;

/**
 * Validate and parse config with Zod.
 * Returns parsed config with defaults applied, or throws with detailed errors.
 */
export function validateConfig<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n");
    throw new Error(`Config validation failed:\n${errors}`);
  }
  return result.data;
}
