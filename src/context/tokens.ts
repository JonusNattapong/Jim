import { encoding_for_model, type Tiktoken } from "tiktoken";

/**
 * Real token counter using tiktoken.
 * Supports OpenAI models (GPT-4, GPT-3.5) and approximate for other models.
 */
export class TokenCounter {
  private encoder: Tiktoken | null = null;
  private fallbackRatio = 4; // ~4 chars per token fallback

  constructor() {
    try {
      // Use cl100k_base encoding (GPT-4/GPT-3.5-turbo)
      this.encoder = encoding_for_model("gpt-4");
    } catch {
      this.encoder = null;
    }
  }

  /**
   * Count tokens in a string.
   */
  count(text: string): number {
    if (this.encoder) {
      try {
        return this.encoder.encode(text).length;
      } catch {
        return Math.ceil(text.length / this.fallbackRatio);
      }
    }
    return Math.ceil(text.length / this.fallbackRatio);
  }

  /**
   * Count tokens in a message array.
   */
  countMessages(messages: Array<{ role: string; content: string | null | Array<{ type: string; text?: string }> }>): number {
    let total = 0;

    for (const msg of messages) {
      // Each message has ~4 overhead tokens (role, separators)
      total += 4;

      if (typeof msg.content === "string") {
        total += this.count(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if ("text" in part && part.text) {
            total += this.count(part.text);
          }
        }
      }
    }

    total += 2; // reply priming
    return total;
  }

  /**
   * Estimate how many tokens to keep for response.
   */
  remainingTokens(used: number, maxContext: number = 200_000, maxOutput: number = 4096): number {
    return Math.max(0, maxContext - used - maxOutput);
  }

  /**
   * Check if context is approaching limit.
   */
  shouldCompact(used: number, maxContext: number = 200_000): boolean {
    return used > maxContext * 0.85;
  }

  /**
   * Truncate text to fit within token limit.
   */
  truncate(text: string, maxTokens: number): string {
    const tokenCount = this.count(text);
    if (tokenCount <= maxTokens) return text;

    const ratio = maxTokens / tokenCount;
    const charLimit = Math.floor(text.length * ratio * 0.9); // 90% safety margin
    return text.slice(0, charLimit) + "\n... (truncated)";
  }

  /**
   * Estimate cost for a model.
   */
  estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    const rates: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 2.50 / 1_000_000, output: 10 / 1_000_000 },
      "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
      "gpt-4-turbo": { input: 10 / 1_000_000, output: 30 / 1_000_000 },
      "gpt-4": { input: 30 / 1_000_000, output: 60 / 1_000_000 },
      "o1": { input: 15 / 1_000_000, output: 60 / 1_000_000 },
      "o1-mini": { input: 3 / 1_000_000, output: 12 / 1_000_000 },
      "o3-mini": { input: 1.10 / 1_000_000, output: 4.40 / 1_000_000 },
      "claude-3-5-sonnet-20241022": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
      "claude-3-5-haiku-20241022": { input: 0.80 / 1_000_000, output: 4 / 1_000_000 },
      "claude-3-opus-20240229": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
      "gemini-1.5-pro": { input: 1.25 / 1_000_000, output: 5 / 1_000_000 },
      "gemini-1.5-flash": { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
      "deepseek-chat": { input: 0.27 / 1_000_000, output: 1.10 / 1_000_000 },
      "deepseek-reasoner": { input: 0.55 / 1_000_000, output: 2.19 / 1_000_000 },
    };

    const rate = rates[model] ?? { input: 2 / 1_000_000, output: 8 / 1_000_000 };
    return inputTokens * rate.input + outputTokens * rate.output;
  }

  /**
   * Free the encoder when done.
   */
  free(): void {
    if (this.encoder) {
      try { this.encoder.free(); } catch { /* already freed */ }
      this.encoder = null;
    }
  }
}

// Singleton instance
let counter: TokenCounter | null = null;

export function getTokenCounter(): TokenCounter {
  if (!counter) counter = new TokenCounter();
  return counter;
}
