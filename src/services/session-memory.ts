/**
 * Session Memory Extraction Service
 * 
 * Inspired by Claude Code's session memory system that periodically extracts
 * key information from conversations using a forked subagent.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SessionMemoryConfig {
  enabled: boolean;
  initializationThreshold: number;
  updateThreshold: number;
  maxMemorySizeKb: number;
  maxTurnsForExtraction: number;
  extractionTimeoutMs: number;
}

export interface SessionMemoryState {
  isInitialized: boolean;
  toolCallsSinceLastExtraction: number;
  totalToolCalls: number;
  lastExtractionAt?: number;
  lastProcessedMessageUuid?: string;
  memoryFilePath?: string;
}

export interface ExtractionResult {
  success: boolean;
  extractedItems: number;
  memorySizeBytes: number;
  durationMs: number;
  error?: string;
}

export interface ExtractedItem {
  type: "decision" | "fact" | "preference" | "context" | "todo";
  content: string;
  timestamp: number;
  messageUuid?: string;
  confidence: number;
}

const DEFAULT_CONFIG: SessionMemoryConfig = {
  enabled: true,
  initializationThreshold: 10,
  updateThreshold: 20,
  maxMemorySizeKb: 50,
  maxTurnsForExtraction: 50,
  extractionTimeoutMs: 30_000,
};

export class SessionMemoryManager {
  private config: SessionMemoryConfig;
  private state: SessionMemoryState;
  private extractionQueue: ExtractedItem[] = [];

  constructor(config: Partial<SessionMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isInitialized: false,
      toolCallsSinceLastExtraction: 0,
      totalToolCalls: 0,
    };
  }

  async initialize(projectRoot: string): Promise<void> {
    const memoryDir = path.join(projectRoot, ".jim", "sessions");
    await fs.mkdir(memoryDir, { recursive: true });
    const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    this.state.memoryFilePath = path.join(memoryDir, `session-${sessionId}.md`);
    const existingMemoryPath = path.join(projectRoot, ".session.md");
    try {
      await fs.access(existingMemoryPath);
      this.state.isInitialized = true;
      this.state.memoryFilePath = existingMemoryPath;
    } catch {
      // No existing memory
    }
  }

  recordToolCall(messageUuid?: string): boolean {
    if (!this.config.enabled) return false;
    this.state.totalToolCalls++;
    this.state.toolCallsSinceLastExtraction++;
    this.state.lastProcessedMessageUuid = messageUuid;
    if (!this.state.isInitialized) {
      return this.state.toolCallsSinceLastExtraction >= this.config.initializationThreshold;
    }
    return this.state.toolCallsSinceLastExtraction >= this.config.updateThreshold;
  }

  queueExtraction(item: ExtractedItem): void {
    this.extractionQueue.push(item);
  }

  extractFromMessages(messages: Array<{ role: string; content: string; uuid?: string }>): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant" && msg.role !== "user") continue;
      const content = msg.content.toLowerCase();
      if (content.includes("decided") || content.includes("will use") || content.includes("going with")) {
        items.push({ type: "decision", content: msg.content.slice(0, 500), timestamp: Date.now(), messageUuid: msg.uuid, confidence: 0.8 });
      }
      if (content.includes("prefer") || content.includes("i like") || content.includes("always use")) {
        items.push({ type: "preference", content: msg.content.slice(0, 500), timestamp: Date.now(), messageUuid: msg.uuid, confidence: 0.7 });
      }
      if (content.includes("note that") || content.includes("important:") || content.includes("remember")) {
        items.push({ type: "fact", content: msg.content.slice(0, 500), timestamp: Date.now(), messageUuid: msg.uuid, confidence: 0.9 });
      }
      const todoMatch = msg.content.match(/TODO[:\s]+(.+?)(?:\n|$)/i);
      if (todoMatch) {
        items.push({ type: "todo", content: todoMatch[1], timestamp: Date.now(), messageUuid: msg.uuid, confidence: 1.0 });
      }
    }
    return items;
  }

  async persistExtraction(items: ExtractedItem[]): Promise<ExtractionResult> {
    const startTime = Date.now();
    if (!this.state.memoryFilePath) {
      return { success: false, extractedItems: 0, memorySizeBytes: 0, durationMs: Date.now() - startTime, error: "Memory file path not set" };
    }
    try {
      const markdown = this.formatAsMarkdown(items);
      const sizeKb = Buffer.byteLength(markdown, "utf-8") / 1024;
      if (sizeKb > this.config.maxMemorySizeKb) {
        const maxChars = this.config.maxMemorySizeKb * 1024;
        await fs.writeFile(this.state.memoryFilePath, markdown.slice(0, maxChars), "utf-8");
      } else {
        try {
          const existing = await fs.readFile(this.state.memoryFilePath, "utf-8");
          await fs.writeFile(this.state.memoryFilePath, existing + "\n" + markdown, "utf-8");
        } catch {
          await fs.writeFile(this.state.memoryFilePath, markdown, "utf-8");
        }
      }
      this.state.isInitialized = true;
      this.state.lastExtractionAt = Date.now();
      this.state.toolCallsSinceLastExtraction = 0;
      this.extractionQueue = [];
      const stats = await fs.stat(this.state.memoryFilePath);
      return { success: true, extractedItems: items.length, memorySizeBytes: stats.size, durationMs: Date.now() - startTime };
    } catch (error) {
      return { success: false, extractedItems: 0, memorySizeBytes: 0, durationMs: Date.now() - startTime, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private formatAsMarkdown(items: ExtractedItem[]): string {
    if (items.length === 0) return "";
    const lines = [`## Session Extract - ${new Date().toISOString()}`, ""];
    const grouped: Record<string, ExtractedItem[]> = {};
    for (const item of items) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    }
    for (const [type, typeItems] of Object.entries(grouped)) {
      lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s`, "");
      for (const item of typeItems) lines.push(`- ${item.content}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  getState(): SessionMemoryState { return { ...this.state }; }
  getConfig(): SessionMemoryConfig { return { ...this.config }; }

  isExtractionDue(): boolean {
    if (!this.config.enabled) return false;
    if (!this.state.isInitialized) return this.state.toolCallsSinceLastExtraction >= this.config.initializationThreshold;
    return this.state.toolCallsSinceLastExtraction >= this.config.updateThreshold;
  }

  getExtractionPrompt(): string {
    return `Extract key information from this conversation. Focus on decisions, facts, preferences, TODOs, and context. Output JSON array with type, content, confidence fields.`;
  }

  reset(): void {
    this.state = { isInitialized: false, toolCallsSinceLastExtraction: 0, totalToolCalls: 0 };
    this.extractionQueue = [];
  }
}

export async function hasSessionMemory(projectRoot: string): Promise<boolean> {
  try { await fs.access(path.join(projectRoot, ".session.md")); return true; } catch { return false; }
}

export async function loadSessionMemory(projectRoot: string): Promise<string | null> {
  try { return await fs.readFile(path.join(projectRoot, ".session.md"), "utf-8"); } catch { return null; }
}

export function getSessionMemoryPath(projectRoot: string): string {
  return path.join(projectRoot, ".session.md");
}

export const SessionMemory = { SessionMemoryManager, hasSessionMemory, loadSessionMemory, getSessionMemoryPath } as const;