import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { randomUUID } from "node:crypto";
import { childLogger } from "../utils/logger.js";
import type { ToolDefinition, ToolHandler, ToolResult } from "../tools/types.js";
import { ToolRegistry } from "../tools/registry.js";

export interface QueryEngineConfig {
  provider: OpenAI;
  model: string;
  tools: ToolDefinition[];
  toolHandlers: Map<string, ToolHandler>;
  maxTurns?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  systemPrompt?: string;
  temperature?: number;
  verbose?: boolean;
  maxOutputTokens?: number;
  onUsageUpdate?: (usage: TokenUsage) => void;
  onError?: (error: Error) => void;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface QueryMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface QueryResult {
  content: string;
  toolCalls: ToolCall[];
  toolResults: ToolResultEntry[];
  usage: TokenUsage;
  finishReason: string;
}

export interface ToolResultEntry {
  toolCallId: string;
  name: string;
  result: ToolResult;
  duration: number;
}

export interface StreamingChunk {
  type: "content" | "tool_call" | "usage" | "error";
  content?: string;
  toolCall?: ToolCall;
  usage?: TokenUsage;
  error?: string;
}

interface QueuedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * QueryEngine manages LLM interactions with robust error handling,
 * retry logic, streaming support, and comprehensive metrics tracking.
 */
export class QueryEngine {
  private config: QueryEngineConfig;
  private messages: QueryMessage[] = [];
  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private turnCount = 0;
  private log = childLogger({ component: "QueryEngine" });
  private abortController: AbortController | null = null;
  private isStreaming = false;

  constructor(config: QueryEngineConfig) {
    this.config = {
      maxTurns: 25,
      maxRetries: 3,
      retryDelayMs: 1000,
      temperature: 0.7,
      maxOutputTokens: 8192,
      verbose: false,
      ...config,
    };

    if (this.config.systemPrompt) {
      this.messages.push({
        role: "system",
        content: this.config.systemPrompt,
      });
    }
  }

  /**
   * Submit a user message and get the complete response (non-streaming).
   * Handles tool calls automatically with retry logic.
   */
  async submitMessage(
    prompt: string,
    options?: { signal?: AbortSignal }
  ): Promise<QueryResult> {
    this.abortController = new AbortController();

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        this.abortController?.abort();
      });
    }

    const userMessage: QueryMessage = {
      role: "user",
      content: prompt,
    };
    this.messages.push(userMessage);

    try {
      return await this.runConversationLoop();
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Submit a message and stream the response.
   */
  async *submitMessageStreaming(
    prompt: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamingChunk, QueryResult | undefined, unknown> {
    this.abortController = new AbortController();
    this.isStreaming = true;

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        this.abortController?.abort();
      });
    }

    const userMessage: QueryMessage = {
      role: "user",
      content: prompt,
    };
    this.messages.push(userMessage);

    try {
      const result = await this.runConversationLoopStreaming(
        async function* (chunk: StreamingChunk) {
          yield chunk;
        }()
      );
      return result;
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /**
   * Main conversation loop with automatic tool execution.
   */
  private async runConversationLoop(): Promise<QueryResult> {
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResultEntry[] = [];
    let finalContent = "";
    let finalFinishReason = "";

    while (this.turnCount < (this.config.maxTurns ?? 25)) {
      this.turnCount++;
      this.log.debug(`Turn ${this.turnCount}/${this.config.maxTurns}`);

      const response = await this.callLLMWithRetry();

      finalContent = response.content;
      finalFinishReason = response.finishReason;

      // Track token usage
      if (response.usage) {
        this.totalUsage.promptTokens += response.usage.promptTokens;
        this.totalUsage.completionTokens += response.usage.completionTokens;
        this.totalUsage.totalTokens += response.usage.totalTokens;
        this.config.onUsageUpdate?.(this.totalUsage);
      }

      // Add assistant message to history
      const assistantMessage: QueryMessage = {
        role: "assistant",
        content: response.content,
      };
      if (response.toolCalls.length > 0) {
        assistantMessage.tool_calls = response.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }));
      }
      this.messages.push(assistantMessage);

      // If no tool calls, we're done
      if (response.toolCalls.length === 0) {
        return {
          content: finalContent,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          usage: this.totalUsage,
          finishReason: finalFinishReason,
        };
      }

      // Process tool calls
      allToolCalls.push(...response.toolCalls);

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        allToolResults.push(result);

        // Add tool result to message history
        this.messages.push({
          role: "tool",
          content: result.result.content,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }
    }

    // Max turns reached
    return {
      content: finalContent + "\n\n[Maximum turns reached]",
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      usage: this.totalUsage,
      finishReason: "max_turns",
    };
  }

  /**
   * Streaming version of conversation loop.
   */
  private async runConversationLoopStreaming(
    generator: AsyncGenerator<StreamingChunk>
  ): Promise<QueryResult> {
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResultEntry[] = [];
    let finalContent = "";
    let finalFinishReason = "";

    while (this.turnCount < (this.config.maxTurns ?? 25)) {
      this.turnCount++;

      const response = await this.callLLMStreaming();

      finalContent = response.content;
      finalFinishReason = response.finishReason;

      // Track usage
      if (response.usage) {
        this.totalUsage.promptTokens += response.usage.promptTokens;
        this.totalUsage.completionTokens += response.usage.completionTokens;
        this.totalUsage.totalTokens += response.usage.totalTokens;
        this.config.onUsageUpdate?.(this.totalUsage);
      }

      // Add assistant message
      const assistantMessage: QueryMessage = {
        role: "assistant",
        content: response.content,
      };
      if (response.toolCalls.length > 0) {
        assistantMessage.tool_calls = response.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }));
      }
      this.messages.push(assistantMessage);

      if (response.toolCalls.length === 0) {
        return {
          content: finalContent,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          usage: this.totalUsage,
          finishReason: finalFinishReason,
        };
      }

      allToolCalls.push(...response.toolCalls);

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        allToolResults.push(result);

        this.messages.push({
          role: "tool",
          content: result.result.content,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }
    }

    return {
      content: finalContent + "\n\n[Maximum turns reached]",
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      usage: this.totalUsage,
      finishReason: "max_turns",
    };
  }

  /**
   * Call LLM with retry logic for transient errors.
   */
  private async callLLMWithRetry(): Promise<{
    content: string;
    toolCalls: ToolCall[];
    usage: TokenUsage;
    finishReason: string;
  }> {
    const maxRetries = this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.abortController?.signal.aborted) {
          throw new Error("Query aborted");
        }

        return await this.callLLM();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.isRetryableError(lastError) && attempt < maxRetries - 1) {
          const delay = (this.config.retryDelayMs ?? 1000) * Math.pow(2, attempt);
          this.log.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
          await this.sleep(delay);
        } else {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("Unknown error in LLM call");
  }

  /**
   * Single LLM call.
   */
  private async callLLM(): Promise<{
    content: string;
    toolCalls: ToolCall[];
    usage: TokenUsage;
    finishReason: string;
  }> {
    const openaiTools: ChatCompletionTool[] = this.config.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as Record<string, unknown>,
      },
    }));

    const completion = await this.config.provider.chat.completions.create(
      {
        model: this.config.model,
        messages: this.messages as ChatCompletionMessageParam[],
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        temperature: this.config.temperature,
        max_tokens: this.config.maxOutputTokens,
      },
      {
        signal: this.abortController?.signal,
      }
    );

    const choice = completion.choices[0];
    const message = choice.message;

    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        try {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        } catch {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: { raw: tc.function.arguments },
          });
        }
      }
    }

    return {
      content: message.content ?? "",
      toolCalls,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? "unknown",
    };
  }

  /**
   * Streaming LLM call.
   */
  private async callLLMStreaming(): Promise<{
    content: string;
    toolCalls: ToolCall[];
    usage: TokenUsage;
    finishReason: string;
  }> {
    const openaiTools: ChatCompletionTool[] = this.config.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as Record<string, unknown>,
      },
    }));

    const stream = await this.config.provider.chat.completions.create(
      {
        model: this.config.model,
        messages: this.messages as ChatCompletionMessageParam[],
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        temperature: this.config.temperature,
        max_tokens: this.config.maxOutputTokens,
        stream: true,
      },
      {
        signal: this.abortController?.signal,
      }
    );

    let content = "";
    const queuedToolCalls: QueuedToolCall[] = [];
    let finishReason = "";
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      if (this.abortController?.signal.aborted) {
        throw new Error("Query aborted");
      }

      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        content += delta.content;
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id && tc.function?.name) {
            queuedToolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
            });
          }
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    // Deduplicate tool calls by ID
    const seen = new Set<string>();
    const toolCalls: ToolCall[] = [];
    for (const tc of queuedToolCalls) {
      if (!seen.has(tc.id)) {
        seen.add(tc.id);
        toolCalls.push(tc);
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: finishReason || "stop",
    };
  }

  /**
   * Execute a tool call with error handling and timing.
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResultEntry> {
    const startTime = Date.now();
    const handler = this.config.toolHandlers.get(toolCall.name);

    if (!handler) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: {
          content: `Error: Tool "${toolCall.name}" not found`,
          isError: true,
        },
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await handler(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: {
          content: `Error executing tool: ${msg}`,
          isError: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if an error is retryable.
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      "rate limit",
      "timeout",
      "connection",
      "network",
      "econnreset",
      "etimedout",
      "econnrefused",
      "temporary",
      "unavailable",
      "overloaded",
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Abort the current query.
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Get current message history.
   */
  getMessages(): QueryMessage[] {
    return [...this.messages];
  }

  /**
   * Get total token usage.
   */
  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Clear conversation history (keep system prompt).
   */
  clearHistory(): void {
    const systemMessages = this.messages.filter((m) => m.role === "system");
    this.messages = systemMessages;
    this.turnCount = 0;
  }

  /**
   * Add a message to history directly.
   */
  addMessage(message: QueryMessage): void {
    this.messages.push(message);
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a query engine from a tool registry.
 */
export function createQueryEngine(
  provider: OpenAI,
  model: string,
  registry: ToolRegistry,
  config?: Partial<QueryEngineConfig>
): QueryEngine {
  return new QueryEngine({
    provider,
    model,
    tools: registry.getAllTools(),
    toolHandlers: registry.getAllHandlers(),
    ...config,
  });
}
