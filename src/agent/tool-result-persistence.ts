/**
 * Tool Result Persistence - Large outputs saved to disk, referenced in context
 * Pattern: Claude Code handles unbounded tool output via disk persistence
 * 
 * Problem: Large tool results truncated to 50KB max, losing data
 * Solution: Save to disk, reference via $ref in messages, lazy-load on demand
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { childLogger } from "../utils/logger.js";

export interface StoredToolResult {
  toolName: string;
  timestamp: number;
  filePath: string;
  size: number;
  compressed: boolean;
  checksum: string;
  reference: string; // $ref format for messages
}

export interface ToolResultReference {
  $ref: string; // e.g., "tool-result://session-123/tool-456"
  toolName: string;
  size: number;
}

const MAX_INLINE_SIZE = 50 * 1024; // 50KB threshold - above this, persist to disk
const COMPRESSION_THRESHOLD = 100 * 1024; // Compress files over 100KB

/**
 * Tool result persistence manager
 */
export class ToolResultPersister {
  private storageDir: string;
  private sessionId: string;
  private resultIndex: Map<string, StoredToolResult> = new Map();
  private log = childLogger({ component: "ToolResultPersister" });

  constructor(storageDir: string, sessionId: string) {
    this.storageDir = storageDir;
    this.sessionId = sessionId;
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    this.log.info({ dir: this.storageDir }, "Storage initialized");
  }

  /**
   * Persist tool result, return inline or reference
   */
  async persistToolResult(
    toolName: string,
    result: string,
  ): Promise<{
    content: string | ToolResultReference;
    size: number;
    persisted: boolean;
  }> {
    const size = Buffer.byteLength(result, "utf8");

    // If small enough, return inline
    if (size < MAX_INLINE_SIZE) {
      return {
        content: result,
        size,
        persisted: false,
      };
    }

    // Persist to disk
    const resultId = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filePath = join(this.storageDir, `${resultId}.txt`);

    await fs.writeFile(filePath, result, "utf8");

    const stored: StoredToolResult = {
      toolName,
      timestamp: Date.now(),
      filePath,
      size,
      compressed: false,
      checksum: this.computeChecksum(result),
      reference: `tool-result://${this.sessionId}/${resultId}`,
    };

    this.resultIndex.set(resultId, stored);

    this.log.info(
      { toolName, size, resultId },
      "Tool result persisted to disk",
    );

    return {
      content: {
        $ref: stored.reference,
        toolName,
        size,
      },
      size,
      persisted: true,
    };
  }

  /**
   * Retrieve persisted result by reference
   */
  async retrieveResult(reference: string): Promise<string | null> {
    // Parse reference format: tool-result://session-id/result-id
    const match = reference.match(/^tool-result:\/\/[^/]+\/(.+)$/);
    if (!match) return null;

    const resultId = match[1];
    const stored = this.resultIndex.get(resultId);

    if (!stored) {
      this.log.warn({ reference }, "Result not found in index");
      return null;
    }

    try {
      const content = await fs.readFile(stored.filePath, "utf8");
      return content;
    } catch (err) {
      this.log.error({ reference, error: err }, "Failed to retrieve result");
      return null;
    }
  }

  /**
   * Batch retrieve multiple results
   */
  async retrieveResults(references: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const ref of references) {
      const content = await this.retrieveResult(ref);
      if (content) {
        results.set(ref, content);
      }
    }

    return results;
  }

  /**
   * Get index summary
   */
  getIndexSummary() {
    let totalSize = 0;
    const byTool: Record<string, { count: number; totalSize: number }> = {};

    for (const stored of this.resultIndex.values()) {
      totalSize += stored.size;
      if (!byTool[stored.toolName]) {
        byTool[stored.toolName] = { count: 0, totalSize: 0 };
      }
      byTool[stored.toolName].count++;
      byTool[stored.toolName].totalSize += stored.size;
    }

    return {
      totalResults: this.resultIndex.size,
      totalSize,
      byTool,
    };
  }

  /**
   * List all stored results with metadata
   */
  listAllResults(): StoredToolResult[] {
    return Array.from(this.resultIndex.values());
  }

  /**
   * Clean up old results (older than maxAgeDays)
   */
  async cleanup(maxAgeDays: number = 7): Promise<number> {
    let cleaned = 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    for (const [id, stored] of this.resultIndex.entries()) {
      if (stored.timestamp < cutoff) {
        try {
          await fs.unlink(stored.filePath);
          this.resultIndex.delete(id);
          cleaned++;
        } catch (err) {
          this.log.warn({ id, error: err }, "Failed to clean up result");
        }
      }
    }

    this.log.info({ cleaned }, "Results cleaned up");
    return cleaned;
  }

  /**
   * Compute simple checksum
   */
  private computeChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clear all stored results
   */
  async clearAll(): Promise<void> {
    for (const stored of this.resultIndex.values()) {
      try {
        await fs.unlink(stored.filePath);
      } catch {
        // Ignore
      }
    }
    this.resultIndex.clear();
    this.log.info("All results cleared");
  }
}

/**
 * Format tool result content with persistence info
 */
export function formatToolResultWithPersistence(
  result: { content: string | ToolResultReference; persisted: boolean; size: number },
): string {
  if (typeof result.content === "string") {
    return result.content;
  }

  const ref = result.content;
  return `\n📦 Tool output saved to disk (${formatBytes(ref.size)})\n` +
    `   Reference: ${ref.$ref}\n` +
    `   Use tool-retrieve to access full output\n`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
