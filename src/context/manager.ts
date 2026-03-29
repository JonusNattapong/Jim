import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
import { getTokenCounter } from "./tokens.js";
import type { TokenCounter } from "./tokens.js";

/** Optional LLM summarizer function type */
export type SummarizerFn = (messages: ChatCompletionMessageParam[]) => Promise<string>;

export class ContextManager {
  private messages: ChatCompletionMessageParam[] = [];
  private maxToolOutput: number;
  private tokenCounter: TokenCounter;
  private summarizer?: SummarizerFn;

  constructor(maxToolOutput: number = 5000) {
    this.maxToolOutput = maxToolOutput;
    this.tokenCounter = getTokenCounter();
  }

  /** Set an LLM-based summarizer for better compaction */
  setSummarizer(fn: SummarizerFn): void {
    this.summarizer = fn;
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addRawMessage(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  addAssistantMessage(message: {
    content?: string | null;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> | null;
  }): void {
    const msg: ChatCompletionMessageParam = { role: "assistant", content: message.content ?? null };
    if (message.tool_calls) {
      (msg as unknown as Record<string, unknown>).tool_calls = message.tool_calls;
    }
    this.messages.push(msg);
  }

  addToolResults(results: ChatCompletionToolMessageParam[]): void {
    for (const r of results) this.messages.push(r);
  }

  getMessages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  /**
   * Real token counting via tiktoken.
   */
  estimateTokens(): number {
    try {
      return this.tokenCounter.countMessages(
        this.messages as Array<{ role: string; content: string | null }>
      );
    } catch {
      // Fallback: ~4 chars per token
      let total = 0;
      for (const msg of this.messages) {
        if (typeof msg.content === "string") total += msg.content.length / 4;
      }
      return Math.round(total);
    }
  }

  shouldCompact(maxContext: number = 200_000): boolean {
    return this.tokenCounter.shouldCompact(this.estimateTokens(), maxContext);
  }

  /**
   * Compact context by summarizing older messages.
   * If a summarizer is set, uses LLM for quality summary.
   * Otherwise falls back to string truncation.
   */
  async compact(): Promise<void> {
    if (this.messages.length <= 6) return;

    const recentCount = 6;
    const older = this.messages.slice(0, -recentCount);
    const recent = this.messages.slice(-recentCount);

    let summary: string;
    if (this.summarizer) {
      try {
        summary = await this.summarizer(older);
      } catch {
        summary = this.buildSummary(older);
      }
    } else {
      summary = this.buildSummary(older);
    }

    this.messages = [
      { role: "user", content: `[Previous conversation summary]\n${summary}\n\n[Continue from here]` },
      ...recent,
    ];
  }

  /** Synchronous compaction (always uses string summary) */
  compactSync(): void {
    if (this.messages.length <= 6) return;

    const recentCount = 6;
    const older = this.messages.slice(0, -recentCount);
    const recent = this.messages.slice(-recentCount);
    const summary = this.buildSummary(older);

    this.messages = [
      { role: "user", content: `[Previous conversation summary]\n${summary}\n\n[Continue from here]` },
      ...recent,
    ];
  }

  private buildSummary(messages: ChatCompletionMessageParam[]): string {
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "user" && typeof msg.content === "string") {
        const preview = msg.content.slice(0, 200);
        parts.push(`User: ${preview}${msg.content.length > 200 ? "..." : ""}`);
      } else if (msg.role === "assistant") {
        if (typeof msg.content === "string" && msg.content) {
          const preview = msg.content.slice(0, 200);
          parts.push(`Assistant: ${preview}${msg.content.length > 200 ? "..." : ""}`);
        }
        const msgRecord = msg as unknown as Record<string, unknown>;
        if (msgRecord.tool_calls && Array.isArray(msgRecord.tool_calls)) {
          for (const tc of msgRecord.tool_calls) {
            const tcObj = tc as unknown as { function: { name: string } };
            parts.push(`Tool called: ${tcObj.function.name}`);
          }
        }
      } else if (msg.role === "tool") {
        const preview = typeof msg.content === "string" ? msg.content.slice(0, 100) : "";
        parts.push(`Tool result: ${preview}...`);
      }
    }

    return parts.join("\n");
  }

  clear(): void {
    this.messages = [];
  }
}
