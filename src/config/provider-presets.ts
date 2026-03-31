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

export const PROVIDER_PRESETS: ProviderPreset[] = [
  // --- Popular ---
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    support: "simple",
    adapter: "openai-compatible",
    description: "Curated models including Claude, GPT, Gemini and more.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "OPENCODE_API_KEY", required: true, secret: true, placeholder: "Get key at opencode.ai/zen" }),
      field("baseUrl", "Base URL", { envVar: "OPENCODE_BASE_URL", defaultValue: "https://api.opencode.ai/v1" })
    ],
    notes: "Reliable optimized models for coding agents. Use 'public' for free tier."
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    support: "simple",
    adapter: "openai-compatible",
    description: "Low cost subscription for everyone.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "OPENCODE_GO_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "OPENCODE_GO_BASE_URL", defaultValue: "https://api.opencode.go.ai/v1" })
    ],
    notes: "Affordable, balanced inference service."
  },
  {
    id: "anthropic",
    label: "Anthropic",
    support: "simple",
    adapter: "anthropic",
    description: "Direct access to Claude models, including Pro and Max.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "ANTHROPIC_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "ANTHROPIC_BASE_URL", defaultValue: "https://api.anthropic.com" })
    ],
    notes: "Native Messages API. Recommended for Claude 3.5 Sonnet."
  },
  {
    id: "openai",
    label: "OpenAI",
    support: "simple",
    adapter: "openai",
    description: "GPT models for fast, capable general AI tasks.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "OPENAI_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "OPENAI_BASE_URL", defaultValue: "https://api.openai.com/v1" })
    ],
    notes: "Uses Responses API for newer models (o1, 4o)."
  },
  {
    id: "google",
    label: "Google Gemini",
    support: "simple",
    adapter: "vertex-ai",
    description: "Gemini models for fast, structured responses.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "GOOGLE_API_KEY", required: true, secret: true }),
      field("project", "Project ID", { envVar: "GOOGLE_CLOUD_PROJECT", required: true }),
      field("location", "Location", { envVar: "GOOGLE_CLOUD_LOCATION", defaultValue: "us-central1" })
    ],
    notes: "Gemini 1.5 Pro and Flash via Vertex AI or Studio."
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    support: "simple",
    adapter: "openai-compatible",
    description: "Access all supported models from one provider.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "OPENROUTER_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "OPENROUTER_BASE_URL", defaultValue: "https://openrouter.ai/api/v1" })
    ],
    notes: "Universal gateway with per-model pricing."
  },

  // --- Other ---
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    support: "simple",
    adapter: "azure-openai",
    description: "Enterprise-grade OpenAI on Microsoft Azure.",
    source: "opencode",
    fields: [
      field("apiKey", "Azure API key", { envVar: "AZURE_OPENAI_API_KEY", required: true, secret: true }),
      field("baseUrl", "Resource Endpoint", { envVar: "AZURE_OPENAI_ENDPOINT", required: true, placeholder: "https://res.openai.azure.com" }),
      field("deployment", "Deployment Name", { envVar: "AZURE_OPENAI_DEPLOYMENT", required: true }),
      field("apiVersion", "API Version", { envVar: "AZURE_OPENAI_API_VERSION", defaultValue: "2024-08-01-preview" })
    ]
  },
  {
    id: "amazon-bedrock",
    label: "Amazon Bedrock",
    support: "simple",
    adapter: "bedrock",
    description: "AWS-native provider with SigV4 signing.",
    source: "opencode",
    fields: [
      field("accessKeyId", "AWS access key", { envVar: "AWS_ACCESS_KEY_ID", required: true, secret: true }),
      field("secretAccessKey", "AWS secret key", { envVar: "AWS_SECRET_ACCESS_KEY", required: true, secret: true }),
      field("region", "AWS region", { envVar: "AWS_REGION", defaultValue: "us-east-1" })
    ]
  },
  {
    id: "groq",
    label: "Groq",
    support: "simple",
    adapter: "openai-compatible",
    description: "Ultra-fast inference for open source models.",
    source: "opencode",
    fields: [
      field("apiKey", "Groq API key", { envVar: "GROQ_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "GROQ_BASE_URL", defaultValue: "https://api.groq.com/openai/v1" })
    ]
  },
  {
    id: "mistral",
    label: "Mistral AI",
    support: "simple",
    adapter: "openai-compatible",
    description: "Mistral and Mixtral models.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "MISTRAL_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { defaultValue: "https://api.mistral.ai/v1" })
    ]
  },
  {
    id: "xai",
    label: "xAI",
    support: "simple",
    adapter: "openai-compatible",
    description: "Grok models via OpenAI-compatible endpoint.",
    source: "opencode",
    fields: [
      field("apiKey", "xAI API key", { envVar: "XAI_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "XAI_BASE_URL", defaultValue: "https://api.x.ai/v1" })
    ]
  },
  {
    id: "perplexity",
    label: "Perplexity",
    support: "simple",
    adapter: "openai-compatible",
    description: "Search-augmented LLM API.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "PERPLEXITY_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { defaultValue: "https://api.perplexity.ai" })
    ]
  },
  {
    id: "together-ai",
    label: "Together AI",
    support: "simple",
    adapter: "openai-compatible",
    description: "Open source models at high speed.",
    source: "opencode",
    fields: [
      field("apiKey", "Together API key", { envVar: "TOGETHER_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "TOGETHER_BASE_URL", defaultValue: "https://api.together.xyz/v1" })
    ]
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    support: "simple",
    adapter: "openai-compatible",
    description: "Low-cost inference for open models.",
    source: "opencode",
    fields: [
      field("apiKey", "DeepInfra API key", { envVar: "DEEPINFRA_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "DEEPINFRA_BASE_URL", defaultValue: "https://api.deepinfra.com/v1/openai" })
    ]
  },
  {
    id: "cerebras",
    label: "Cerebras",
    support: "simple",
    adapter: "openai-compatible",
    description: "Wafer-scale AI inference.",
    source: "opencode",
    fields: [
      field("apiKey", "Cerebras API key", { envVar: "CEREBRAS_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "CEREBRAS_BASE_URL", defaultValue: "https://api.cerebras.ai/v1" })
    ]
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    support: "simple",
    adapter: "openai-compatible",
    description: "High-performance models like DeepSeek V3 and R1.",
    source: "opencode",
    fields: [
      field("apiKey", "DeepSeek API key", { envVar: "DEEPSEEK_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "DEEPSEEK_BASE_URL", defaultValue: "https://api.deepseek.com/v1" })
    ]
  },
  {
    id: "kilocode",
    label: "Kilocode",
    support: "simple",
    adapter: "openai-compatible",
    description: "High-speed coding specialized models.",
    source: "opencode",
    fields: [
      field("apiKey", "Kilocode API key", { envVar: "KILOCODE_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "KILOCODE_BASE_URL", defaultValue: "https://api.kilocode.com/v1" })
    ]
  },
  {
    id: "minimax",
    label: "MiniMax",
    support: "simple",
    adapter: "openai-compatible",
    description: "MiniMax-m2.5 specialized in short/long context.",
    source: "opencode",
    fields: [
      field("apiKey", "MiniMax API key", { envVar: "MINIMAX_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "MINIMAX_BASE_URL", defaultValue: "https://api.minimax.io/v1" })
    ]
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    support: "simple",
    adapter: "openai-compatible",
    description: "Kimi models for long context research.",
    source: "opencode",
    fields: [
      field("apiKey", "Moonshot API key", { envVar: "MOONSHOT_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "MOONSHOT_BASE_URL", defaultValue: "https://api.moonshot.ai/v1" })
    ]
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    support: "simple",
    adapter: "openai-compatible",
    description: "Run models locally on your machine.",
    source: "opencode",
    fields: [
      field("baseUrl", "Base URL", { envVar: "OLLAMA_BASE_URL", defaultValue: "http://localhost:11434/v1" }),
      field("apiKey", "API key", { defaultValue: "local", secret: true })
    ],
    notes: "Requires Ollama to be running locally (`ollama serve`)."
  },
  {
    id: "scaleway",
    label: "Scaleway",
    support: "simple",
    adapter: "openai-compatible",
    description: "Scaleway Generative AI models.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "SCALEWAY_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "SCALEWAY_BASE_URL", defaultValue: "https://api.scaleway.ai/v1" })
    ]
  },
  {
    id: "venice-ai",
    label: "Venice AI",
    support: "simple",
    adapter: "openai-compatible",
    description: "Private and uncensored AI via Venice.",
    source: "opencode",
    fields: [
      field("apiKey", "API key", { envVar: "VENICE_API_KEY", required: true, secret: true }),
      field("baseUrl", "Base URL", { envVar: "VENICE_BASE_URL", defaultValue: "https://api.venice.ai/api/v1" })
    ]
  },
];

export function getProviderPresets(): ProviderPreset[] {
  return [...PROVIDER_PRESETS];
}

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
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
