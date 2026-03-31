import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
import { getTokenCounter } from "./tokens.js";
import type { TokenCounter } from "./tokens.js";

/** Optional LLM summarizer function type */
export type SummarizerFn = (messages: ChatCompletionMessageParam[]) => Promise<string>;

export interface TokenBudget {
  totalBudget: number;
  inputUsed: number;
  outputUsed: number;
  reserved: number;
}

export interface CompactionMetrics {
  bytesBeforeCompaction: number;
  tokensBeforeCompaction: number;
  messagesTotalBefore: number;
  bytesAfterCompaction: number;
  tokensAfterCompaction: number;
  messagesAfterCompaction: number;
  compressionRatio: number;
}

export class ContextManager {
  private messages: ChatCompletionMessageParam[] = [];
  private maxToolOutput: number;
  private tokenCounter: TokenCounter;
  private summarizer?: SummarizerFn;
  private tokenBudget: TokenBudget;
  private compactionHistory: CompactionMetrics[] = [];
  private maxCompactions: number = 10;
  private pinnedIndices: Set<number> = new Set();
  private consecutiveCompactionFailures: number = 0;
  private readonly MAX_COMPACTION_RETRY = 3;
  private readonly MICRO_COMPACT_THRESHOLD = 5; // Keep only last N tool results if redundant
  private readonly COMPACTABLE_TOOLS = new Set(["run_command", "list_dir", "grep", "search_web", "read_file"]);

  constructor(maxToolOutput: number = 5000, tokenBudget: number = 100000) {
    this.maxToolOutput = maxToolOutput;
    this.tokenCounter = getTokenCounter();
    this.tokenBudget = {
      totalBudget: tokenBudget,
      inputUsed: 0,
      outputUsed: 0,
      reserved: Math.floor(tokenBudget * 0.2), // Reserve 20% for final response
    };
  }

  /** Mark a message index as pinned (protected from compaction) */
  pinMessage(index: number): void {
    if (index >= 0 && index < this.messages.length) {
      this.pinnedIndices.add(index);
    }
  }

  /** Unpin a message */
  unpinMessage(index: number): void {
    this.pinnedIndices.delete(index);
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
    this.microCompact();
  }

  /**
   * Pillar 17: Micro-Compaction
   * Prunes older redundant tool results from the message history to save tokens
   * without triggering a full LLM-based summarization.
   */
  private microCompact(): void {
    if (this.messages.length < 10) return;

    const toolUsageCount: Record<string, number> = {};
    const messagesToClear: number[] = [];

    // Walk backwards and mark tools for clearing if they exceed the threshold
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === "tool") {
        const toolMsg = msg as ChatCompletionToolMessageParam;
        const caller = this.messages.find(m => 
          m.role === "assistant" && 
          (m as any).tool_calls?.some((tc: any) => tc.id === toolMsg.tool_call_id)
        );
        
        const toolName = caller 
          ? (caller as any).tool_calls.find((tc: any) => tc.id === toolMsg.tool_call_id)?.function?.name 
          : "unknown";

        if (this.COMPACTABLE_TOOLS.has(toolName)) {
          toolUsageCount[toolName] = (toolUsageCount[toolName] || 0) + 1;
          if (toolUsageCount[toolName] > this.MICRO_COMPACT_THRESHOLD && !this.pinnedIndices.has(i)) {
            messagesToClear.push(i);
          }
        }
      }
    }

    // Apply clearing
    for (const idx of messagesToClear) {
      const msg = this.messages[idx];
      if (msg.role === "tool" && typeof msg.content === "string" && msg.content.length > 50) {
        msg.content = `[Older ${idx} result cleared to save context tokens]`;
      }
    }
  }

  getMessages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  estimateTokens(): number {
    try {
      return this.tokenCounter.countMessages(
        this.messages as Array<{ role: string; content: string | null }>
      );
    } catch {
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
   * Compact context by summarizing older messages (with metrics tracking).
   */
  async compact(): Promise<void> {
    if (this.messages.length <= 6) return;

    // Circuit breaker (Pillar 21)
    if (this.consecutiveCompactionFailures >= this.MAX_COMPACTION_RETRY) {
      console.warn(`[ContextManager] Circuit breaker engaged. Skipping compaction.`);
      return;
    }

    const beforeMetrics = {
      bytesBeforeCompaction: JSON.stringify(this.messages).length,
      tokensBeforeCompaction: this.estimateTokens(),
      messagesTotalBefore: this.messages.length,
    };

    const recentCount = 6;
    const splitIndex = this.messages.length - recentCount;
    const older = this.messages.slice(0, splitIndex);
    const recent = this.messages.slice(splitIndex);

    const preservedPinned: ChatCompletionMessageParam[] = [];
    const toSummarize: ChatCompletionMessageParam[] = [];
    
    for (let i = 0; i < older.length; i++) {
      if (this.pinnedIndices.has(i)) {
        preservedPinned.push(older[i]);
      } else {
        toSummarize.push(older[i]);
      }
    }

    let summary: string = "";
    if (toSummarize.length > 0) {
      if (this.summarizer) {
        try {
          summary = await this.summarizer(toSummarize);
          this.consecutiveCompactionFailures = 0;
        } catch (error) {
          console.error("[ContextManager] LLM summarizer failed:", error);
          this.consecutiveCompactionFailures++;
          summary = this.buildSummary(toSummarize);
        }
      } else {
        summary = this.buildSummary(toSummarize);
      }
    } else {
      summary = "Initial context preserved.";
    }

    this.messages = [
      { role: "user", content: `[Previous conversation summary]\n${summary}\n\n[Continue from here]` },
      ...preservedPinned,
      ...recent,
    ];

    // Re-map pinned indices
    const newPinnedIndices = new Set<number>();
    for (let i = 0; i < preservedPinned.length; i++) {
      newPinnedIndices.add(i + 1);
    }
    const recentStart = 1 + preservedPinned.length;
    for (const oldIdx of this.pinnedIndices) {
      if (oldIdx >= splitIndex) {
        newPinnedIndices.add(oldIdx - splitIndex + recentStart);
      }
    }
    this.pinnedIndices = newPinnedIndices;

    const afterMetrics = {
      bytesAfterCompaction: JSON.stringify(this.messages).length,
      tokensAfterCompaction: this.estimateTokens(),
      messagesAfterCompaction: this.messages.length,
      compressionRatio: beforeMetrics.bytesBeforeCompaction / Math.max(1, JSON.stringify(this.messages).length),
    };

    this.compactionHistory.push({ ...beforeMetrics, ...afterMetrics });
    if (this.compactionHistory.length > this.maxCompactions) this.compactionHistory.shift();
  }

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
        parts.push(`User: ${msg.content.slice(0, 100)}...`);
      } else if (msg.role === "assistant") {
        if (msg.content) parts.push(`Assistant: ${msg.content.slice(0, 100)}...`);
        const msgRecord = msg as any;
        if (msgRecord.tool_calls) {
          for (const tc of msgRecord.tool_calls) parts.push(`Tool: ${tc.function?.name || tc.name}`);
        }
      } else if (msg.role === "tool") {
        parts.push(`Result: ${typeof msg.content === "string" ? msg.content.slice(0, 50) : ""}...`);
      }
    }
    return parts.join("\n");
  }

  clear(): void {
    this.messages = [];
  }

  trackTokenUsage(inputTokens: number, outputTokens: number): void {
    this.tokenBudget.inputUsed += inputTokens;
    this.tokenBudget.outputUsed += outputTokens;
  }

  getRemainingBudget(): number {
    const used = this.tokenBudget.inputUsed + this.tokenBudget.outputUsed;
    const available = this.tokenBudget.totalBudget - this.tokenBudget.reserved;
    return Math.max(0, available - used);
  }

  hasRemainingBudget(estimatedTokens: number = 5000): boolean {
    return this.getRemainingBudget() > estimatedTokens;
  }

  getTokenBudgetStatus() {
    const used = this.tokenBudget.inputUsed + this.tokenBudget.outputUsed;
    const percentage = (used / (this.tokenBudget?.totalBudget || 1)) * 100;
    return {
      totalBudget: this.tokenBudget.totalBudget,
      used,
      inputUsed: this.tokenBudget.inputUsed,
      outputUsed: this.tokenBudget.outputUsed,
      remaining: this.getRemainingBudget(),
      percentageUsed: percentage,
      needsCompaction: percentage > 70,
    };
  }

  getCompactionStats() {
    if (this.compactionHistory.length === 0) return null;
    const latest = this.compactionHistory[this.compactionHistory.length - 1];
    return {
      compactionCount: this.compactionHistory.length,
      latestMetrics: latest,
    };
  }
}
