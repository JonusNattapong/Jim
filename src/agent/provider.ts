import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type ProviderName = "openai" | "openai-compatible" | "anthropic" | "azure-openai" | "vertex-ai" | "bedrock";
export type ProviderMode = "auto" | ProviderName | "responses" | "chat-completions";
export type ProviderCapability = "streaming" | "tools" | "reasoning" | "vision" | "mcp";

export interface ProviderMetadata {
  name: ProviderName;
  label: string;
  description: string;
  transport: "responses" | "chat-completions";
  endpoint: string;
  supports: ProviderCapability[];
  recommendedModelPatterns: string[];
  notes?: string;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ProviderChunk {
  content: string;
  toolCall?: { index: number; id?: string; name?: string; arguments?: string };
  finishReason?: string;
}

export interface ProviderResponse {
  content: string;
  toolCalls: ProviderToolCall[];
  finishReason: string | null;
}

export interface ProviderOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderCommonTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ProviderToolDef = {
  type: "function";
  function: ProviderCommonTool;
};

export interface ProviderCommonMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
}

export interface ProviderRequest {
  model: string;
  messages: ProviderCommonMessage[];
  tools?: ProviderCommonTool[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMProvider {
  readonly name: ProviderName;
  complete(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
  ): Promise<ProviderResponse>;
  stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse>;
  listModels?(): Promise<string[]>;
}

const PROVIDER_REGISTRY: Record<ProviderName, ProviderMetadata> = {
  openai: {
    name: "openai",
    label: "OpenAI",
    description: "OpenAI Responses API adapter for newer tool-rich models and typed response items.",
    transport: "responses",
    endpoint: "/responses",
    supports: ["streaming", "tools", "reasoning", "vision", "mcp"],
    recommendedModelPatterns: ["gpt-5", "codex", "o3", "o4"],
    notes: "Best fit for GPT-5-era OpenAI models and advanced Responses features.",
  },
  "openai-compatible": {
    name: "openai-compatible",
    label: "OpenAI-Compatible",
    description: "Chat Completions adapter for compatible providers and older message-shaped integrations.",
    transport: "chat-completions",
    endpoint: "/chat/completions",
    supports: ["streaming", "tools", "vision"],
    recommendedModelPatterns: ["grok", "mistral", "minimax", "kilo-auto", "kilocode"],
    notes: "Best fit for OpenAI-compatible gateways and providers that still expose chat.completions.",
  },
  anthropic: {
    name: "anthropic",
    label: "Anthropic",
    description: "Anthropic Messages API adapter with native tool use and streaming support.",
    transport: "chat-completions",
    endpoint: "/v1/messages",
    supports: ["streaming", "tools", "vision"],
    recommendedModelPatterns: ["claude"],
    notes: "Native Anthropic Messages API. Set ANTHROPIC_API_KEY to authenticate.",
  },
  "azure-openai": {
    name: "azure-openai",
    label: "Azure OpenAI",
    description: "Azure-hosted OpenAI with deployment-specific endpoints and API versioning.",
    transport: "chat-completions",
    endpoint: "/openai/deployments/{deployment}/chat/completions",
    supports: ["streaming", "tools", "vision"],
    recommendedModelPatterns: ["gpt-4", "gpt-35"],
    notes: "Requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY. Set AZURE_OPENAI_DEPLOYMENT for the deployment name.",
  },
  "vertex-ai": {
    name: "vertex-ai",
    label: "Google Vertex AI",
    description: "Google Vertex AI adapter for Gemini models via the publisher API.",
    transport: "chat-completions",
    endpoint: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}",
    supports: ["streaming", "tools", "vision"],
    recommendedModelPatterns: ["gemini"],
    notes: "Requires GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, and GOOGLE_API_KEY or GOOGLE_ACCESS_TOKEN.",
  },
  bedrock: {
    name: "bedrock",
    label: "Amazon Bedrock",
    description: "AWS Bedrock adapter with SigV4 signing for Anthropic Claude and other foundation models.",
    transport: "chat-completions",
    endpoint: "/model/{model}/invoke",
    supports: ["streaming", "tools"],
    recommendedModelPatterns: ["claude", "titan", "llama"],
    notes: "Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION. Optionally AWS_SESSION_TOKEN.",
  },
};

export function getProviderRegistry(): ProviderMetadata[] {
  return Object.values(PROVIDER_REGISTRY);
}

export function getProviderMetadata(name: ProviderName): ProviderMetadata {
  return PROVIDER_REGISTRY[name];
}

export function inferProviderFromModel(model: string): ProviderName {
  const normalized = model.toLowerCase();

  // Support provider/model prefix style
  if (normalized.includes("/")) {
    const [prefix] = normalized.split("/");
    if (prefix === "anthropic") return "anthropic";
    if (prefix === "openai") return "openai";
    if (prefix === "google" || prefix === "vertex" || prefix === "gemini" || prefix === "google-vertex") return "vertex-ai";
    if (prefix === "azure") return "azure-openai";
    if (prefix === "aws" || prefix === "bedrock" || prefix === "amazon") return "bedrock";
    if (prefix === "minimax" || prefix === "kilocode" || prefix === "local" || prefix === "ollama" || prefix === "compatible") return "openai-compatible";
  }

  const providerPriority: ProviderName[] = ["openai", "anthropic", "vertex-ai", "bedrock", "azure-openai", "openai-compatible"];
  for (const name of providerPriority) {
    const meta = PROVIDER_REGISTRY[name];
    if (meta.recommendedModelPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
      return name;
    }
  }

  return "openai-compatible";
}

export function normalizeProviderMode(mode?: ProviderMode): ProviderName | undefined {
  if (!mode || mode === "auto") return undefined;
  if (mode === "responses") return "openai";
  if (mode === "chat-completions") return "openai-compatible";
  const validNames: ProviderName[] = ["openai", "openai-compatible", "anthropic", "azure-openai", "vertex-ai", "bedrock"];
  if (validNames.includes(mode as ProviderName)) return mode as ProviderName;
  return undefined;
}

function toCommonMessages(messages: ChatCompletionMessageParam[]): ProviderCommonMessage[] {
  const result: ProviderCommonMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      result.push({ role: "system", content: typeof msg.content === "string" ? msg.content : "" });
      continue;
    }

    if (msg.role === "user") {
      result.push({ role: "user", content: typeof msg.content === "string" ? msg.content : "" });
      continue;
    }

    if (msg.role === "assistant") {
      const toolCalls = Array.isArray((msg as { tool_calls?: unknown }).tool_calls)
        ? ((msg as { tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> }).tool_calls).map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }))
        : undefined;

      result.push({
        role: "assistant",
        content: typeof msg.content === "string" ? msg.content : "",
        tool_calls: toolCalls,
      });
      continue;
    }

    if (msg.role === "tool") {
      const toolMsg = msg as unknown as { tool_call_id?: string; content?: string };
      result.push({
        role: "tool",
        tool_call_id: toolMsg.tool_call_id,
        content: typeof toolMsg.content === "string" ? toolMsg.content : "",
      });
    }
  }

  return result;
}

function toCommonTools(tools: ProviderToolDef[]): ProviderCommonTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

function ensureObjectSchema(parameters: Record<string, unknown>): Record<string, unknown> {
  const schema = parameters && typeof parameters === "object" ? { ...parameters } : {};
  const properties = schema.properties && typeof schema.properties === "object"
    ? schema.properties as Record<string, unknown>
    : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  return {
    type: "object",
    ...schema,
    properties: Object.keys(properties).length > 0
      ? properties
      : { _unused: { type: "string", description: "Placeholder" } },
    required,
  };
}

function finalizeChatResponse(choice: {
  message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
  finish_reason?: string | null;
}): ProviderResponse {
  const message = choice.message;
  const toolCalls: ProviderToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: message?.content ?? "",
    toolCalls,
    finishReason: choice.finish_reason ?? null,
  };
}

function getClientConfig(client: OpenAI): { baseURL: string; apiKey: string } {
  const raw = client as unknown as { baseURL?: string; apiKey?: string };
  return {
    baseURL: raw.baseURL ?? "https://api.openai.com/v1",
    apiKey: raw.apiKey ?? "",
  };
}

export class ChatCompletionsProvider implements LLMProvider {
  readonly name = "openai-compatible" as const;
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const request = this.toRequest(messages, tools, options);
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map((message) => {
        if (message.role === "assistant") {
          return {
            role: "assistant" as const,
            content: message.content ?? null,
            tool_calls: message.tool_calls?.map((toolCall) => ({
              id: toolCall.id,
              type: "function" as const,
              function: {
                name: toolCall.name,
                arguments: toolCall.arguments,
              },
            })),
          };
        }

        if (message.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: message.tool_call_id ?? "",
            content: message.content ?? "",
          };
        }

        return {
          role: message.role,
          content: message.content ?? "",
        };
      }),
      tools: request.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: ensureObjectSchema(tool.parameters),
        },
      })),
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 4096,
    });

    const choice = response.choices[0];
    if (!choice) return { content: "", toolCalls: [], finishReason: null };
    return finalizeChatResponse(choice);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const request = this.toRequest(messages, tools, { ...options });
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map((message) => {
        if (message.role === "assistant") {
          return {
            role: "assistant" as const,
            content: message.content ?? null,
            tool_calls: message.tool_calls?.map((toolCall) => ({
              id: toolCall.id,
              type: "function" as const,
              function: {
                name: toolCall.name,
                arguments: toolCall.arguments,
              },
            })),
          };
        }

        if (message.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: message.tool_call_id ?? "",
            content: message.content ?? "",
          };
        }

        return {
          role: message.role,
          content: message.content ?? "",
        };
      }),
      tools: request.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: ensureObjectSchema(tool.parameters),
        },
      })),
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = "";
    let finishReason: string | null = null;
    const toolCalls = new Map<number, ProviderToolCall>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
        onChunk({ content: "", finishReason });
      }

      if (choice.delta.content) {
        content += choice.delta.content;
        onChunk({ content: choice.delta.content });
      }

      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const index = tc.index ?? 0;
          const existing = toolCalls.get(index) ?? { id: "", name: "", arguments: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolCalls.set(index, existing);

          onChunk({
            content: "",
            toolCall: {
              index,
              id: tc.id ?? undefined,
              name: tc.function?.name ?? undefined,
              arguments: tc.function?.arguments ?? undefined,
            },
          });
        }
      }
    }

    return {
      content,
      toolCalls: Array.from(toolCalls.values()),
      finishReason,
    };
  }

  async listModels(): Promise<string[]> {
    const config = getClientConfig(this.client);
    const response = await fetch(`${config.baseURL}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json() as { data: Array<{ id: string }> };
    return data.data?.map(m => m.id) ?? [];
  }

  private toRequest(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): ProviderRequest {
    return {
      model: options.model,
      messages: toCommonMessages(messages),
      tools: toCommonTools(tools),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    };
  }
}

interface ResponsesInputItem {
  type: string;
  text?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  output?: string;
}

interface ResponsesInputMessage {
  role: "developer" | "user" | "assistant";
  content: string | ResponsesInputItem[];
}

interface ResponsesFunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ResponsesRequestBody {
  model: string;
  input: ResponsesInputMessage[];
  tools?: ResponsesFunctionTool[];
  temperature?: number;
  max_output_tokens?: number;
  stream?: boolean;
  tool_choice?: "auto" | "none" | { type: "function"; name: string };
  truncation?: "auto" | "disabled";
}

interface ResponsesResponseBody {
  status: string;
  output?: Array<{
    type: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  output_text?: string;
  error?: { message: string };
}

export class ResponsesProvider implements LLMProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const request = this.toRequest(messages, tools, options);
    const response = await this.rawRequest("/responses", request);
    return this.parseResponse(response);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const request = this.toRequest(messages, tools, { ...options, });
    const response = await this.rawStreamRequest("/responses", { ...request, stream: true });
    return this.parseStream(response, onChunk);
  }

  async listModels(): Promise<string[]> {
    const config = getClientConfig(this.client);
    const response = await fetch(`${config.baseURL}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json() as { data: Array<{ id: string }> };
    return data.data?.map(m => m.id) ?? [];
  }

  private toRequest(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): ResponsesRequestBody {
    return {
      model: options.model,
      input: toCommonMessages(messages).flatMap((message) => {
        if (message.role === "system") {
          return [{ role: "developer" as const, content: message.content ?? "" }];
        }

        if (message.role === "user") {
          return [{ role: "user" as const, content: message.content ?? "" }];
        }

        if (message.role === "assistant") {
          const entries: ResponsesInputMessage[] = [];
          if (message.content) {
            entries.push({ role: "assistant", content: message.content });
          }
          for (const toolCall of message.tool_calls ?? []) {
            entries.push({
              role: "assistant",
              content: [{
                type: "function_call",
                name: toolCall.name,
                arguments: toolCall.arguments,
                call_id: toolCall.id,
              }],
            });
          }
          return entries;
        }

        if (message.role === "tool") {
          return [{
            role: "user" as const,
            content: [{
              type: "function_call_output",
              call_id: message.tool_call_id,
              output: message.content ?? "",
            }],
          }];
        }

        return [];
      }),
      tools: toCommonTools(tools).map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: ensureObjectSchema(tool.parameters),
      })),
      temperature: options.temperature ?? 0,
      max_output_tokens: options.maxTokens ?? 4096,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      truncation: "auto",
    };
  }

  private parseResponse(body: ResponsesResponseBody): ProviderResponse {
    if (body.error) {
      throw new Error(body.error.message);
    }

    const toolCalls: ProviderToolCall[] = [];
    let content = body.output_text ?? "";

    for (const item of body.output ?? []) {
      if (item.type === "function_call") {
        toolCalls.push({
          id: item.call_id ?? item.id ?? "",
          name: item.name ?? "",
          arguments: item.arguments ?? "{}",
        });
      }

      if (item.type === "message") {
        for (const part of item.content ?? []) {
          if (part.type === "output_text" && part.text) {
            content += part.text;
          }
        }
      }
    }

    return {
      content,
      toolCalls,
      finishReason: body.status === "completed" ? "stop" : body.status,
    };
  }

  private parseStream(response: Response, onChunk: (chunk: ProviderChunk) => void): Promise<ProviderResponse> {
    return new Promise(async (resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error("No response body"));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let finishReason: string | null = null;
      const toolCalls = new Map<number, ProviderToolCall>();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            const eventName = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "";
            const dataLine = lines.find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            const data = dataLine.slice(6);
            if (data === "[DONE]") continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(data) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (eventName === "response.output_text.delta") {
              const delta = typeof event.delta === "string" ? event.delta : "";
              if (!delta) continue;
              content += delta;
              onChunk({ content: delta });
              continue;
            }

            if (eventName === "response.output_item.added") {
              const item = event.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const index = typeof event.output_index === "number" ? event.output_index : 0;
                toolCalls.set(index, {
                  id: typeof item.call_id === "string" ? item.call_id : typeof item.id === "string" ? item.id : "",
                  name: typeof item.name === "string" ? item.name : "",
                  arguments: "",
                });
              }
              continue;
            }

            if (eventName === "response.function_call_arguments.delta") {
              const index = typeof event.output_index === "number" ? event.output_index : 0;
              const delta = typeof event.delta === "string" ? event.delta : "";
              const existing = toolCalls.get(index);
              if (existing) {
                existing.arguments += delta;
                toolCalls.set(index, existing);
              }
              onChunk({ content: "", toolCall: { index, arguments: delta } });
              continue;
            }

            if (eventName === "response.completed") {
              finishReason = "stop";
              onChunk({ content: "", finishReason: "stop" });
              continue;
            }

            if (eventName === "response.failed") {
              finishReason = "error";
              onChunk({ content: "", finishReason: "error" });
            }
          }
        }

        resolve({
          content,
          toolCalls: Array.from(toolCalls.values()),
          finishReason,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async rawRequest(path: string, body: ResponsesRequestBody): Promise<ResponsesResponseBody> {
    const client = getClientConfig(this.client);
    const response = await fetch(`${client.baseURL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Responses API error ${response.status}: ${text.slice(0, 300)}`);
    }

    return response.json() as Promise<ResponsesResponseBody>;
  }

  private async rawStreamRequest(path: string, body: ResponsesRequestBody): Promise<Response> {
    const client = getClientConfig(this.client);
    const response = await fetch(`${client.baseURL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Responses API error ${response.status}: ${text.slice(0, 300)}`);
    }

    return response;
  }
}

export class AzureOpenAIProvider implements LLMProvider {
  readonly name = "azure-openai" as const;
  private client: OpenAI;
  private deployment: string;
  private apiVersion: string;

  constructor(client: OpenAI) {
    this.client = client;
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "";
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const model = this.deployment || options.model;
    const response = await this.client.chat.completions.create({
      model,
      messages: this.transformMessages(messages),
      tools: this.transformTools(tools),
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 4096,
    });

    const choice = response.choices[0];
    if (!choice) return { content: "", toolCalls: [], finishReason: null };
    return finalizeChatResponse(choice);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const model = this.deployment || options.model;
    const stream = await this.client.chat.completions.create({
      model,
      messages: this.transformMessages(messages),
      tools: this.transformTools(tools),
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = "";
    let finishReason: string | null = null;
    const toolCalls = new Map<number, ProviderToolCall>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
        onChunk({ content: "", finishReason });
      }

      if (choice.delta.content) {
        content += choice.delta.content;
        onChunk({ content: choice.delta.content });
      }

      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const index = tc.index ?? 0;
          const existing = toolCalls.get(index) ?? { id: "", name: "", arguments: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolCalls.set(index, existing);

          onChunk({
            content: "",
            toolCall: {
              index,
              id: tc.id ?? undefined,
              name: tc.function?.name ?? undefined,
              arguments: tc.function?.arguments ?? undefined,
            },
          });
        }
      }
    }

    return {
      content,
      toolCalls: Array.from(toolCalls.values()),
      finishReason,
    };
  }

  private transformMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
    return messages;
  }

  private transformTools(tools: ProviderToolDef[]): ProviderToolDef[] {
    return tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: ensureObjectSchema(tool.function.parameters),
      },
    }));
  }
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: { type?: string; text?: string; partial_json?: string };
  content_block?: AnthropicContentBlock;
  message?: { id: string; usage?: { input_tokens: number; output_tokens: number } };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private apiKey: string;
  private baseUrl: string;

  constructor(client: OpenAI) {
    const config = getClientConfig(client);
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseURL ?? "https://api.anthropic.com").replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const body = this.buildRequest(messages, tools, options);
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json() as AnthropicResponse;
    return this.parseResponse(data);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const body = { ...this.buildRequest(messages, tools, options), stream: true };
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 300)}`);
    }

    return this.parseStream(response, onChunk);
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  private buildRequest(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Record<string, unknown> {
    const { system, anthropicMessages } = this.transformMessages(messages);
    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      messages: anthropicMessages,
    };
    if (system) body.system = system;
    if (options.temperature != null) body.temperature = options.temperature;
    if (tools.length > 0) {
      body.tools = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: ensureObjectSchema(tool.function.parameters),
      }));
    }
    return body;
  }

  private transformMessages(messages: ChatCompletionMessageParam[]): { system?: string; anthropicMessages: Array<Record<string, unknown>> } {
    let system: string | undefined;
    const anthropicMessages: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = typeof msg.content === "string" ? msg.content : "";
        continue;
      }

      if (msg.role === "user") {
        anthropicMessages.push({
          role: "user",
          content: typeof msg.content === "string" ? msg.content : "",
        });
        continue;
      }

      if (msg.role === "assistant") {
        const content: Array<Record<string, unknown>> = [];
        if (msg.content) {
          content.push({ type: "text", text: typeof msg.content === "string" ? msg.content : "" });
        }
        const toolCalls = Array.isArray((msg as { tool_calls?: unknown }).tool_calls)
          ? (msg as { tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> }).tool_calls
          : [];
        for (const tc of toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: safeParseJSON(tc.function.arguments),
          });
        }
        anthropicMessages.push({ role: "assistant", content });
        continue;
      }

      if (msg.role === "tool") {
        const toolMsg = msg as unknown as { tool_call_id?: string; content?: string };
        anthropicMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: toolMsg.tool_call_id,
            content: toolMsg.content ?? "",
          }],
        });
      }
    }

    return { system, anthropicMessages };
  }

  private parseResponse(data: AnthropicResponse): ProviderResponse {
    const toolCalls: ProviderToolCall[] = [];
    let content = "";

    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        content += block.text;
      }
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id ?? "",
          name: block.name ?? "",
          arguments: JSON.stringify(block.input ?? {}),
        });
      }
    }

    return {
      content,
      toolCalls,
      finishReason: this.mapStopReason(data.stop_reason),
    };
  }

  private parseStream(response: Response, onChunk: (chunk: ProviderChunk) => void): Promise<ProviderResponse> {
    return new Promise(async (resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) { reject(new Error("No response body")); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let finishReason: string | null = null;
      const toolCalls = new Map<number, ProviderToolCall>();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            const eventType = lines.find((l) => l.startsWith("event: "))?.slice(7);
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (!dataLine || !eventType) continue;

            let event: AnthropicStreamEvent;
            try { event = JSON.parse(dataLine.slice(6)) as AnthropicStreamEvent; }
            catch { continue; }

            if (eventType === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
              content += event.delta.text;
              onChunk({ content: event.delta.text });
            }

            if (eventType === "content_block_start" && event.content_block?.type === "tool_use") {
              const idx = event.index ?? 0;
              toolCalls.set(idx, {
                id: event.content_block.id ?? "",
                name: event.content_block.name ?? "",
                arguments: "",
              });
            }

            if (eventType === "content_block_delta" && event.delta?.type === "input_json_delta" && event.delta.partial_json) {
              const idx = event.index ?? 0;
              const existing = toolCalls.get(idx);
              if (existing) {
                existing.arguments += event.delta.partial_json;
                toolCalls.set(idx, existing);
                onChunk({ content: "", toolCall: { index: idx, arguments: event.delta.partial_json } });
              }
            }

            if (eventType === "message_delta") {
              const reason = event.delta && (event.delta as Record<string, unknown>).stop_reason as string | undefined;
              if (reason) {
                finishReason = this.mapStopReason(reason);
                onChunk({ content: "", finishReason });
              }
            }
          }
        }

        resolve({ content, toolCalls: Array.from(toolCalls.values()), finishReason });
      } catch (error) { reject(error); }
    });
  }

  private mapStopReason(reason: string | null): string {
    switch (reason) {
      case "end_turn": return "stop";
      case "tool_use": return "tool_calls";
      case "max_tokens": return "length";
      default: return reason ?? "stop";
    }
  }
}

interface VertexAIRequestBody {
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  system_instruction?: { parts: Array<{ text: string }> };
  tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
}

interface VertexAIResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
}

export class VertexAIProvider implements LLMProvider {
  readonly name = "vertex-ai" as const;
  private apiKey: string;
  private baseUrl: string;
  private project: string;
  private location: string;

  constructor(client: OpenAI) {
    const config = getClientConfig(client);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseURL ?? "https://aiplatform.googleapis.com";
    this.project = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.VERTEX_PROJECT ?? "";
    this.location = process.env.GOOGLE_CLOUD_LOCATION ?? process.env.VERTEX_LOCATION ?? "us-central1";
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const body = this.buildRequest(messages, tools, options);
    const url = `${this.baseUrl}/v1/projects/${this.project}/locations/${this.location}/publishers/google/models/${options.model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vertex AI error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json() as VertexAIResponse;
    return this.parseResponse(data);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const body = this.buildRequest(messages, tools, options);
    const url = `${this.baseUrl}/v1/projects/${this.project}/locations/${this.location}/publishers/google/models/${options.model}:streamGenerateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vertex AI error ${response.status}: ${text.slice(0, 300)}`);
    }

    return this.parseStreamResponse(response, onChunk);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey && this.apiKey !== "local") {
      h.Authorization = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private buildRequest(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): VertexAIRequestBody {
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: VertexAIRequestBody["contents"] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: typeof msg.content === "string" ? msg.content : "" }] };
        continue;
      }

      if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: typeof msg.content === "string" ? msg.content : "" }] });
        continue;
      }

      if (msg.role === "assistant") {
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content) parts.push({ text: typeof msg.content === "string" ? msg.content : "" });
        const toolCalls = Array.isArray((msg as { tool_calls?: unknown }).tool_calls)
          ? (msg as { tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> }).tool_calls
          : [];
        for (const tc of toolCalls) {
          parts.push({ functionCall: { name: tc.function.name, args: safeParseJSON(tc.function.arguments) } });
        }
        contents.push({ role: "model", parts });
        continue;
      }

      if (msg.role === "tool") {
        const toolMsg = msg as unknown as { tool_call_id?: string; content?: string };
        contents.push({
          role: "function",
          parts: [{ functionResponse: { name: toolMsg.tool_call_id ?? "", response: { content: toolMsg.content ?? "" } } }],
        });
      }
    }

    const body: VertexAIRequestBody = { contents };
    if (systemInstruction) body.system_instruction = systemInstruction;
    if (options.temperature != null || options.maxTokens != null) {
      body.generationConfig = {};
      if (options.temperature != null) body.generationConfig.temperature = options.temperature;
      if (options.maxTokens != null) body.generationConfig.maxOutputTokens = options.maxTokens;
    }
    if (tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: ensureObjectSchema(tool.function.parameters),
        })),
      }];
    }
    return body;
  }

  private parseResponse(data: VertexAIResponse): ProviderResponse {
    const candidate = data.candidates?.[0];
    if (!candidate) return { content: "", toolCalls: [], finishReason: null };

    const toolCalls: ProviderToolCall[] = [];
    let content = "";

    for (const part of candidate.content?.parts ?? []) {
      if (part.text) content += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.name,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        });
      }
    }

    return {
      content,
      toolCalls,
      finishReason: this.mapFinishReason(candidate.finishReason),
    };
  }

  private parseStreamResponse(response: Response, onChunk: (chunk: ProviderChunk) => void): Promise<ProviderResponse> {
    return new Promise(async (resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) { reject(new Error("No response body")); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const toolCalls = new Map<number, ProviderToolCall>();
      let finishReason: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "," || trimmed.startsWith("[")) continue;
            const clean = trimmed.replace(/,\s*$/, "");
            if (!clean || clean === "]") continue;

            let data: VertexAIResponse;
            try { data = JSON.parse(clean) as VertexAIResponse; }
            catch { continue; }

            const candidate = data.candidates?.[0];
            if (!candidate) continue;

            for (const part of candidate.content?.parts ?? []) {
              if (part.text) {
                content += part.text;
                onChunk({ content: part.text });
              }
              if (part.functionCall) {
                const idx = toolCalls.size;
                toolCalls.set(idx, {
                  id: part.functionCall.name,
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args ?? {}),
                });
                onChunk({
                  content: "",
                  toolCall: { index: idx, name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
                });
              }
            }

            if (candidate.finishReason) {
              finishReason = this.mapFinishReason(candidate.finishReason);
              onChunk({ content: "", finishReason });
            }
          }
        }

        resolve({ content, toolCalls: Array.from(toolCalls.values()), finishReason });
      } catch (error) { reject(error); }
    });
  }

  private mapFinishReason(reason: string | undefined): string {
    switch (reason) {
      case "STOP": return "stop";
      case "MAX_TOKENS": return "length";
      case "TOOL_CALLS": return "tool_calls";
      default: return reason ?? "stop";
    }
  }
}

interface BedrockRequestBody {
  anthropic_version: string;
  max_tokens: number;
  messages: Array<Record<string, unknown>>;
  system?: string;
  tools?: Array<Record<string, unknown>>;
  temperature?: number;
}

interface BedrockResponse {
  id: string;
  type: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

export class BedrockProvider implements LLMProvider {
  readonly name = "bedrock" as const;
  private accessKeyId: string;
  private secretAccessKey: string;
  private sessionToken: string;
  private region: string;
  private baseUrl: string;

  constructor(client: OpenAI) {
    const config = getClientConfig(client);
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? "";
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? "";
    this.sessionToken = process.env.AWS_SESSION_TOKEN ?? "";
    this.region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
    this.baseUrl = config.baseURL ?? `https://bedrock-runtime.${this.region}.amazonaws.com`;
  }

  async complete(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): Promise<ProviderResponse> {
    const body = this.buildRequest(messages, tools, options);
    const modelId = options.model;
    const url = `${this.baseUrl}/model/${modelId}/invoke`;

    const signedHeaders = await this.signRequest("POST", url, JSON.stringify(body));
    const response = await fetch(url, {
      method: "POST",
      headers: signedHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Bedrock API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json() as BedrockResponse;
    return this.parseResponse(data);
  }

  async stream(
    messages: ChatCompletionMessageParam[],
    tools: ProviderToolDef[],
    options: ProviderOptions,
    onChunk: (chunk: ProviderChunk) => void,
  ): Promise<ProviderResponse> {
    const body = this.buildRequest(messages, tools, options);
    const modelId = options.model;
    const url = `${this.baseUrl}/model/${modelId}/invoke-with-response-stream`;

    const signedHeaders = await this.signRequest("POST", url, JSON.stringify(body));
    const response = await fetch(url, {
      method: "POST",
      headers: signedHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Bedrock API error ${response.status}: ${text.slice(0, 300)}`);
    }

    return this.parseStreamResponse(response, onChunk);
  }

  private buildRequest(messages: ChatCompletionMessageParam[], tools: ProviderToolDef[], options: ProviderOptions): BedrockRequestBody {
    let system: string | undefined;
    const bedrockMessages: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = typeof msg.content === "string" ? msg.content : "";
        continue;
      }
      if (msg.role === "user") {
        bedrockMessages.push({ role: "user", content: [{ type: "text", text: typeof msg.content === "string" ? msg.content : "" }] });
        continue;
      }
      if (msg.role === "assistant") {
        const content: Array<Record<string, unknown>> = [];
        if (msg.content) content.push({ type: "text", text: typeof msg.content === "string" ? msg.content : "" });
        const toolCalls = Array.isArray((msg as { tool_calls?: unknown }).tool_calls)
          ? (msg as { tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> }).tool_calls
          : [];
        for (const tc of toolCalls) {
          content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: safeParseJSON(tc.function.arguments) });
        }
        bedrockMessages.push({ role: "assistant", content });
        continue;
      }
      if (msg.role === "tool") {
        const toolMsg = msg as unknown as { tool_call_id?: string; content?: string };
        bedrockMessages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolMsg.tool_call_id, content: toolMsg.content ?? "" }],
        });
      }
    }

    const body: BedrockRequestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens ?? 4096,
      messages: bedrockMessages,
    };
    if (system) body.system = system;
    if (options.temperature != null) body.temperature = options.temperature;
    if (tools.length > 0) {
      body.tools = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: ensureObjectSchema(tool.function.parameters),
      }));
    }
    return body;
  }

  private parseResponse(data: BedrockResponse): ProviderResponse {
    const toolCalls: ProviderToolCall[] = [];
    let content = "";

    for (const block of data.content) {
      if (block.type === "text" && block.text) content += block.text;
      if (block.type === "tool_use") {
        toolCalls.push({ id: block.id ?? "", name: block.name ?? "", arguments: JSON.stringify(block.input ?? {}) });
      }
    }

    return {
      content,
      toolCalls,
      finishReason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason === "tool_use" ? "tool_calls" : (data.stop_reason ?? "stop"),
    };
  }

  private parseStreamResponse(response: Response, onChunk: (chunk: ProviderChunk) => void): Promise<ProviderResponse> {
    return new Promise(async (resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) { reject(new Error("No response body")); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const toolCalls = new Map<number, ProviderToolCall>();
      let finishReason: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const line of parts) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            let event: Record<string, unknown>;
            try { event = JSON.parse(payload) as Record<string, unknown>; }
            catch { continue; }

            const chunkData = event.chunk as Record<string, unknown> | undefined;
            if (chunkData?.bytes) {
              const decoded = atob(chunkData.bytes as string);
              let inner: AnthropicStreamEvent;
              try { inner = JSON.parse(decoded) as AnthropicStreamEvent; }
              catch { continue; }

              if (inner.type === "content_block_delta" && inner.delta?.type === "text_delta" && inner.delta.text) {
                content += inner.delta.text;
                onChunk({ content: inner.delta.text });
              }
              if (inner.type === "content_block_start" && inner.content_block?.type === "tool_use") {
                const idx = inner.index ?? 0;
                toolCalls.set(idx, { id: inner.content_block.id ?? "", name: inner.content_block.name ?? "", arguments: "" });
              }
              if (inner.type === "content_block_delta" && inner.delta?.type === "input_json_delta" && inner.delta.partial_json) {
                const idx = inner.index ?? 0;
                const existing = toolCalls.get(idx);
                if (existing) {
                  existing.arguments += inner.delta.partial_json;
                  toolCalls.set(idx, existing);
                  onChunk({ content: "", toolCall: { index: idx, arguments: inner.delta.partial_json } });
                }
              }
              if (inner.type === "message_delta" && inner.delta) {
                const reason = (inner.delta as Record<string, unknown>).stop_reason as string | undefined;
                if (reason) {
                  finishReason = reason === "end_turn" ? "stop" : reason === "tool_use" ? "tool_calls" : reason;
                  onChunk({ content: "", finishReason });
                }
              }
            }
          }
        }

        resolve({ content, toolCalls: Array.from(toolCalls.values()), finishReason });
      } catch (error) { reject(error); }
    });
  }

  private async signRequest(method: string, url: string, body: string): Promise<Record<string, string>> {
    const parsed = new URL(url);
    const host = parsed.host;
    const path = parsed.pathname + parsed.search;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
    const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      host,
      "x-amz-date": amzDate,
    };
    if (this.sessionToken) headers["x-amz-security-token"] = this.sessionToken;

    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
    const payloadHash = await sha256(body);

    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${this.region}/bedrock/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256(canonicalRequest)].join("\n");

    const signingKey = await this.getSignatureKey(dateStamp);
    const signature = await hmacHex(signingKey, stringToSign);

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { ...headers, Authorization: authHeader };
  }

  private async getSignatureKey(dateStamp: string): Promise<ArrayBuffer> {
    const kDate = await hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = await hmac(kDate, this.region);
    const kService = await hmac(kRegion, "bedrock");
    return hmac(kService, "aws4_request");
  }
}

function safeParseJSON(str: string): Record<string, unknown> {
  try { return JSON.parse(str) as Record<string, unknown>; }
  catch { return {}; }
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createProvider(
  client: OpenAI,
  options?: { provider?: ProviderMode },
): LLMProvider {
  const provider = normalizeProviderMode(options?.provider);
  switch (provider) {
    case "openai":
      return new ResponsesProvider(client);
    case "anthropic":
      return new AnthropicProvider(client);
    case "azure-openai":
      return new AzureOpenAIProvider(client);
    case "vertex-ai":
      return new VertexAIProvider(client);
    case "bedrock":
      return new BedrockProvider(client);
    default:
      return new ChatCompletionsProvider(client);
  }
}
