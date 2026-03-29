import type { ProviderName } from "../agent/provider.js";

export type ProviderPresetSupport = "simple" | "catalog-only";

export interface ProviderPresetField {
  key: string;
  label: string;
  envVar?: string;
  required?: boolean;
  secret?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

export interface ProviderPreset {
  id: string;
  label: string;
  support: ProviderPresetSupport;
  adapter?: ProviderName;
  description: string;
  source: "opencode";
  fields: ProviderPresetField[];
  notes?: string;
}

export interface ResolvedProviderPreset extends ProviderPreset {
  configured: boolean;
  values: Record<string, string>;
  envAssignments: Record<string, string>;
  apiKey: string;
  resolvedBaseUrl?: string;
}

function field(key: string, label: string, options: Partial<ProviderPresetField> = {}): ProviderPresetField {
  return { key, label, ...options };
}

const OPENAI_COMPATIBLE_FIELDS = [
  field("apiKey", "API key", { envVar: "OPENAI_API_KEY", required: true, secret: true }),
  field("baseUrl", "Base URL", { envVar: "OPENAI_BASE_URL", required: true }),
];

const OPENCODE_PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "opencode-zen", label: "OpenCode Zen", support: "catalog-only", description: "Hosted OpenCode provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "OPENCODE_API_KEY", required: true, secret: true })] },
  { id: "opencode-go", label: "OpenCode Go", support: "catalog-only", description: "OpenCode hosted Go plans.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "OPENCODE_GO_API_KEY", required: true, secret: true })] },
  { id: "302-ai", label: "302.AI", support: "catalog-only", description: "Third-party provider from OpenCode docs.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "AI302_API_KEY", required: true, secret: true })] },
  { id: "amazon-bedrock", label: "Amazon Bedrock", support: "simple", adapter: "bedrock", description: "AWS-native provider with SigV4 signing.", source: "opencode", fields: [
    field("accessKeyId", "AWS access key", { envVar: "AWS_ACCESS_KEY_ID", required: true, secret: true }),
    field("secretAccessKey", "AWS secret key", { envVar: "AWS_SECRET_ACCESS_KEY", required: true, secret: true }),
    field("region", "AWS region", { envVar: "AWS_REGION", required: true, defaultValue: "us-east-1" }),
    field("baseUrl", "Bedrock base URL", { envVar: "AWS_BEDROCK_BASE_URL", defaultValue: "https://bedrock-runtime.us-east-1.amazonaws.com" }),
    field("sessionToken", "AWS session token", { envVar: "AWS_SESSION_TOKEN", secret: true }),
  ], notes: "Needs AWS credentials and region." },
  { id: "anthropic", label: "Anthropic", support: "simple", adapter: "anthropic", description: "Anthropic native Messages API.", source: "opencode", fields: [
    field("apiKey", "Anthropic API key", { envVar: "ANTHROPIC_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "ANTHROPIC_BASE_URL", defaultValue: "https://api.anthropic.com" }),
  ] },
  { id: "azure-openai", label: "Azure OpenAI", support: "simple", adapter: "azure-openai", description: "Azure-hosted OpenAI deployments.", source: "opencode", fields: [
    field("apiKey", "Azure API key", { envVar: "AZURE_OPENAI_API_KEY", required: true, secret: true }),
    field("baseUrl", "Azure endpoint", { envVar: "AZURE_OPENAI_ENDPOINT", required: true, placeholder: "https://resource.openai.azure.com" }),
    field("deployment", "Deployment", { envVar: "AZURE_OPENAI_DEPLOYMENT", required: true }),
    field("apiVersion", "API version", { envVar: "AZURE_OPENAI_API_VERSION", defaultValue: "2024-08-01-preview" }),
  ] },
  { id: "azure-cognitive-services", label: "Azure Cognitive Services", support: "catalog-only", description: "Azure cognitive services OpenAI endpoint.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "AZURE_API_KEY", required: true, secret: true })] },
  { id: "baseten", label: "Baseten", support: "catalog-only", description: "Baseten inference provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "BASETEN_API_KEY", required: true, secret: true })] },
  { id: "cerebras", label: "Cerebras", support: "simple", adapter: "openai-compatible", description: "Cerebras OpenAI-compatible inference API.", source: "opencode", fields: [
    field("apiKey", "Cerebras API key", { envVar: "CEREBRAS_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "CEREBRAS_BASE_URL", defaultValue: "https://api.cerebras.ai/v1" }),
  ] },
  { id: "cloudflare-ai-gateway", label: "Cloudflare AI Gateway", support: "catalog-only", description: "Cloudflare AI Gateway routing.", source: "opencode", fields: [field("apiKey", "API token", { envVar: "CLOUDFLARE_API_TOKEN", required: true, secret: true })] },
  { id: "cloudflare-workers-ai", label: "Cloudflare Workers AI", support: "catalog-only", description: "Cloudflare Workers AI native API.", source: "opencode", fields: [field("apiKey", "API token", { envVar: "CLOUDFLARE_API_TOKEN", required: true, secret: true })] },
  { id: "cortecs", label: "Cortecs", support: "catalog-only", description: "Cortecs provider from OpenCode docs.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "CORTECS_API_KEY", required: true, secret: true })] },
  { id: "deepseek", label: "DeepSeek", support: "simple", adapter: "openai-compatible", description: "DeepSeek OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "DeepSeek API key", { envVar: "DEEPSEEK_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "DEEPSEEK_BASE_URL", defaultValue: "https://api.deepseek.com/v1" }),
  ] },
  { id: "deepinfra", label: "Deep Infra", support: "simple", adapter: "openai-compatible", description: "DeepInfra OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "DeepInfra API key", { envVar: "DEEPINFRA_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "DEEPINFRA_BASE_URL", defaultValue: "https://api.deepinfra.com/v1/openai" }),
  ] },
  { id: "firmware", label: "Firmware", support: "catalog-only", description: "Firmware provider from OpenCode docs.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "FIRMWARE_API_KEY", required: true, secret: true })] },
  { id: "fireworks-ai", label: "Fireworks AI", support: "simple", adapter: "openai-compatible", description: "Fireworks OpenAI-compatible endpoint.", source: "opencode", fields: [
    field("apiKey", "Fireworks API key", { envVar: "FIREWORKS_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "FIREWORKS_BASE_URL", defaultValue: "https://api.fireworks.ai/inference/v1" }),
  ] },
  { id: "gitlab-duo", label: "GitLab Duo", support: "catalog-only", description: "GitLab Duo / Agent Platform provider.", source: "opencode", fields: [field("apiKey", "GitLab token", { envVar: "GITLAB_TOKEN", required: true, secret: true })] },
  { id: "github-copilot", label: "GitHub Copilot", support: "catalog-only", description: "GitHub Copilot auth flow.", source: "opencode", fields: [field("apiKey", "GitHub token", { envVar: "GITHUB_TOKEN", required: true, secret: true })] },
  { id: "google-vertex-ai", label: "Google Vertex AI", support: "simple", adapter: "vertex-ai", description: "Vertex AI native API for Gemini models.", source: "opencode", fields: [
    field("apiKey", "Google access token or API key", { envVar: "GOOGLE_ACCESS_TOKEN", required: true, secret: true }),
    field("project", "Google Cloud project", { envVar: "GOOGLE_CLOUD_PROJECT", required: true }),
    field("location", "Google Cloud location", { envVar: "GOOGLE_CLOUD_LOCATION", required: true, defaultValue: "us-central1" }),
    field("baseUrl", "Base URL", { envVar: "VERTEX_AI_BASE_URL", defaultValue: "https://aiplatform.googleapis.com" }),
  ], notes: "Use an OAuth bearer token or service-issued access token in the API key field." },
  { id: "groq", label: "Groq", support: "simple", adapter: "openai-compatible", description: "Groq OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "Groq API key", { envVar: "GROQ_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "GROQ_BASE_URL", defaultValue: "https://api.groq.com/openai/v1" }),
  ] },
  { id: "hugging-face", label: "Hugging Face", support: "catalog-only", description: "Hugging Face inference endpoints.", source: "opencode", fields: [field("apiKey", "API token", { envVar: "HF_TOKEN", required: true, secret: true })] },
  { id: "helicone", label: "Helicone", support: "simple", adapter: "openai-compatible", description: "Helicone gateway/proxy provider.", source: "opencode", fields: [
    field("apiKey", "Helicone API key", { envVar: "HELICONE_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "HELICONE_BASE_URL", defaultValue: "https://oai.helicone.ai/v1" }),
  ] },
  { id: "llama-cpp", label: "llama.cpp", support: "simple", adapter: "openai-compatible", description: "llama.cpp OpenAI-compatible llama-server.", source: "opencode", fields: [
    field("apiKey", "API key", { envVar: "LLAMA_CPP_API_KEY", secret: true, defaultValue: "local" }),
    field("baseUrl", "Base URL", { envVar: "LLAMA_CPP_BASE_URL", defaultValue: "http://127.0.0.1:8080/v1", required: true }),
  ] },
  { id: "io-net", label: "IO.NET", support: "catalog-only", description: "IO.NET inference provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "IONET_API_KEY", required: true, secret: true })] },
  { id: "lm-studio", label: "LM Studio", support: "simple", adapter: "openai-compatible", description: "Local LM Studio OpenAI-compatible server.", source: "opencode", fields: [
    field("apiKey", "API key", { envVar: "LM_STUDIO_API_KEY", secret: true, defaultValue: "local" }),
    field("baseUrl", "Base URL", { envVar: "LM_STUDIO_BASE_URL", defaultValue: "http://127.0.0.1:1234/v1", required: true }),
  ], notes: "Uses a local placeholder key if no env is set." },
  { id: "moonshot-ai", label: "Moonshot AI", support: "simple", adapter: "openai-compatible", description: "Moonshot OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "Moonshot API key", { envVar: "MOONSHOT_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "MOONSHOT_BASE_URL", defaultValue: "https://api.moonshot.ai/v1" }),
  ] },
  { id: "minimax", label: "MiniMax", support: "simple", adapter: "openai-compatible", description: "MiniMax OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "MiniMax API key", { envVar: "MINIMAX_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "MINIMAX_BASE_URL", defaultValue: "https://api.minimax.io/v1" }),
  ] },
  { id: "kilocode", label: "Kilocode", support: "simple", adapter: "openai-compatible", description: "Kilocode high-speed inference API.", source: "opencode", fields: [
    field("apiKey", "Kilocode API key", { envVar: "KILOCODE_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "KILOCODE_BASE_URL", defaultValue: "https://api.kilocode.com/v1" }),
  ] },
  { id: "nebius-token-factory", label: "Nebius Token Factory", support: "catalog-only", description: "Nebius token-based provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "NEBIUS_API_KEY", required: true, secret: true })] },
  { id: "ollama", label: "Ollama", support: "simple", adapter: "openai-compatible", description: "Local Ollama OpenAI-compatible endpoint.", source: "opencode", fields: [
    field("apiKey", "API key", { envVar: "OLLAMA_API_KEY", secret: true, defaultValue: "local" }),
    field("baseUrl", "Base URL", { envVar: "OLLAMA_BASE_URL", defaultValue: "http://127.0.0.1:11434/v1", required: true }),
  ], notes: "Uses a local placeholder key if no env is set." },
  { id: "ollama-cloud", label: "Ollama Cloud", support: "catalog-only", description: "Hosted Ollama provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "OLLAMA_CLOUD_API_KEY", required: true, secret: true })] },
  { id: "openai", label: "OpenAI", support: "simple", adapter: "openai", description: "Official OpenAI Responses API.", source: "opencode", fields: [
    field("apiKey", "OpenAI API key", { envVar: "OPENAI_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "OPENAI_BASE_URL", defaultValue: "https://api.openai.com/v1" }),
  ] },
  { id: "openrouter", label: "OpenRouter", support: "simple", adapter: "openai-compatible", description: "OpenRouter OpenAI-compatible gateway.", source: "opencode", fields: [
    field("apiKey", "OpenRouter API key", { envVar: "OPENROUTER_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "OPENROUTER_BASE_URL", defaultValue: "https://openrouter.ai/api/v1" }),
  ] },
  { id: "sap-ai-core", label: "SAP AI Core", support: "catalog-only", description: "SAP AI Core provider.", source: "opencode", fields: [field("serviceKey", "Service key", { envVar: "AICORE_SERVICE_KEY", required: true, secret: true })] },
  { id: "stackit", label: "STACKIT", support: "catalog-only", description: "STACKIT AI models.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "STACKIT_API_KEY", required: true, secret: true })] },
  { id: "ovhcloud-ai-endpoints", label: "OVHcloud AI Endpoints", support: "catalog-only", description: "OVHcloud AI Endpoints provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "OVHCLOUD_AI_API_KEY", required: true, secret: true })] },
  { id: "scaleway", label: "Scaleway", support: "simple", adapter: "openai-compatible", description: "Scaleway Generative APIs through an OpenAI-compatible endpoint.", source: "opencode", fields: [
    field("apiKey", "Scaleway API key", { envVar: "SCALEWAY_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "SCALEWAY_BASE_URL", defaultValue: "https://api.scaleway.ai/v1" }),
  ] },
  { id: "together-ai", label: "Together AI", support: "simple", adapter: "openai-compatible", description: "Together AI OpenAI-compatible endpoint.", source: "opencode", fields: [
    field("apiKey", "Together API key", { envVar: "TOGETHER_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "TOGETHER_BASE_URL", defaultValue: "https://api.together.xyz/v1" }),
  ] },
  { id: "venice-ai", label: "Venice AI", support: "simple", adapter: "openai-compatible", description: "Venice AI OpenAI-compatible API.", source: "opencode", fields: [
    field("apiKey", "Venice API key", { envVar: "VENICE_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "VENICE_BASE_URL", defaultValue: "https://api.venice.ai/api/v1" }),
  ] },
  { id: "vercel-ai-gateway", label: "Vercel AI Gateway", support: "catalog-only", description: "Vercel AI Gateway provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "AI_GATEWAY_API_KEY", required: true, secret: true })] },
  { id: "xai", label: "xAI", support: "simple", adapter: "openai-compatible", description: "xAI OpenAI-compatible endpoint.", source: "opencode", fields: [
    field("apiKey", "xAI API key", { envVar: "XAI_API_KEY", required: true, secret: true }),
    field("baseUrl", "Base URL", { envVar: "XAI_BASE_URL", defaultValue: "https://api.x.ai/v1" }),
  ] },
  { id: "z-ai", label: "Z.AI", support: "catalog-only", description: "Z.AI provider.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "ZAI_API_KEY", required: true, secret: true })] },
  { id: "zenmux", label: "ZenMux", support: "catalog-only", description: "ZenMux gateway.", source: "opencode", fields: [field("apiKey", "API key", { envVar: "ZENMUX_API_KEY", required: true, secret: true })] },
];

export function getProviderPresets(): ProviderPreset[] {
  return [...OPENCODE_PROVIDER_PRESETS];
}

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return OPENCODE_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

export function resolveProviderPreset(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
  saved: Record<string, string> = {},
): ResolvedProviderPreset | undefined {
  const preset = getProviderPreset(id);
  if (!preset) return undefined;

  const values: Record<string, string> = {};
  const envAssignments: Record<string, string> = {};

  for (const item of preset.fields) {
    const envValue = item.envVar ? env[item.envVar] : undefined;
    const value = envValue ?? saved[item.key] ?? item.defaultValue ?? "";
    values[item.key] = value;
    if (item.envVar && value) {
      envAssignments[item.envVar] = value;
    }
  }

  const configured = preset.fields.every((item) => !item.required || Boolean(values[item.key]));

  const apiKey = values.apiKey
    || values.accessKeyId
    || values.serviceKey
    || "local";

  const resolvedBaseUrl = values.baseUrl || undefined;

  return {
    ...preset,
    configured,
    values,
    envAssignments,
    apiKey,
    resolvedBaseUrl,
  };
}

export function formatProviderSetupInstructions(preset: ProviderPreset): string[] {
  const lines = [`Preset: ${preset.label}`];
  lines.push(`Adapter: ${preset.adapter ?? "manual"}`);
  for (const item of preset.fields) {
    lines.push(`${item.label}: ${item.envVar ?? item.key}${item.required ? " (required)" : ""}`);
  }
  if (preset.support !== "simple") lines.push("Status: catalog-only in Jim right now");
  if (preset.notes) lines.push(`Notes: ${preset.notes}`);
  return lines;
}

const ADAPTER_LABELS: Record<string, string> = {
  "openai": "OpenAI",
  "openai-compatible": "OpenAI-compatible",
  "anthropic": "Anthropic",
  "azure-openai": "Azure OpenAI",
  "vertex-ai": "Google Vertex AI",
  "bedrock": "Amazon Bedrock",
};

export function formatProviderDescription(preset: { support: string; configured: boolean; adapter?: string; resolvedBaseUrl?: string }): string {
  const parts: string[] = [];

  // Status
  if (preset.configured) {
    parts.push("Ready");
  } else if (preset.support === "simple") {
    parts.push("Needs setup");
  } else {
    parts.push("Manual setup");
  }

  // Adapter type
  if (preset.adapter) {
    parts.push(ADAPTER_LABELS[preset.adapter] ?? preset.adapter);
  }

  return parts.join(" · ");
}

export function formatConnectionListItem(
  preset: { id: string; label: string; support: string; adapter?: string },
  isCurrent: boolean,
  isConfigured: boolean,
): string {
  const status = isCurrent ? "● active" : isConfigured ? "✓ configured" : "○ not configured";
  return `${preset.label}  [${status}]`;
}
