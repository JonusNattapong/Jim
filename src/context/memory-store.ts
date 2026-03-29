import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  sessionId: string;
  timestamp: string;
  turnNumber?: number;
  metadata: {
    role?: "user" | "assistant" | "tool" | "system";
    tokenCount?: number;
    source?: string;
  };
}

interface IndexEntry {
  id: string;
  preview: string;
  keywords: string[];
  tags: string[];
  timestamp: string;
}

interface MemoryIndex {
  entries: IndexEntry[];
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchedKeywords: string[];
}

// ─── Keyword Extraction ─────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "don", "now", "and", "but", "or", "if", "because", "until", "while",
  "about", "this", "that", "these", "those", "it", "its", "i", "me",
  "my", "myself", "we", "our", "ours", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their", "what", "which", "who",
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Also extract camelCase/PascalCase segments
  const camelParts: string[] = [];
  for (const word of text.split(/\s+/)) {
    const segments = word.split(/(?=[A-Z])|[_\-.]/).filter((s) => s.length > 2);
    camelParts.push(...segments.map((s) => s.toLowerCase()));
  }

  const combined = [...words, ...camelParts];
  const freq = new Map<string, number>();
  for (const w of combined) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  // Return unique keywords sorted by frequency
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w);
}

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── ArchivalMemoryStore ────────────────────────────────────────────────────

/**
 * Persistent memory store backed by JSONL + keyword index.
 * Inspired by MemGPT's archival memory: append-only, searchable, agent-immutable deletions.
 *
 * Storage layout:
 *   ~/.jim/memory/entries.jsonl   — full entries (one per line)
 *   ~/.jim/memory/index.json      — keyword index for fast search
 */
export class ArchivalMemoryStore {
  private memoryDir: string;
  private entriesPath: string;
  private indexPath: string;
  private index: MemoryIndex = { entries: [] };
  private loaded = false;

  constructor(baseDir?: string) {
    const jimDir = baseDir ?? process.env.JIM_MEMORY_DIR ?? resolve(homedir(), ".jim");
    this.memoryDir = join(jimDir, "memory");
    this.entriesPath = join(this.memoryDir, "entries.jsonl");
    this.indexPath = join(this.memoryDir, "index.json");
  }

  /** Reinitialize store to a different directory (for testing) */
  reinit(baseDir: string): void {
    const jimDir = baseDir;
    this.memoryDir = join(jimDir, "memory");
    this.entriesPath = join(this.memoryDir, "entries.jsonl");
    this.indexPath = join(this.memoryDir, "index.json");
    this.index = { entries: [] };
    this.loaded = false;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.memoryDir, { recursive: true });

    try {
      await access(this.indexPath);
      const raw = await readFile(this.indexPath, "utf-8");
      this.index = JSON.parse(raw) as MemoryIndex;
    } catch {
      this.index = { entries: [] };
    }

    this.loaded = true;
  }

  /**
   * Archive a piece of content with optional metadata.
   * Returns the created entry.
   */
  async archive(
    content: string,
    options: {
      tags?: string[];
      sessionId?: string;
      turnNumber?: number;
      role?: MemoryEntry["metadata"]["role"];
      source?: string;
    } = {},
  ): Promise<MemoryEntry> {
    await this.ensureLoaded();

    const entry: MemoryEntry = {
      id: generateId(),
      content,
      tags: options.tags ?? [],
      sessionId: options.sessionId ?? "unknown",
      timestamp: new Date().toISOString(),
      turnNumber: options.turnNumber,
      metadata: {
        role: options.role,
        tokenCount: estimateTokens(content),
        source: options.source,
      },
    };

    // Append to JSONL
    const line = JSON.stringify(entry) + "\n";
    await writeFile(this.entriesPath, line, { flag: "a", encoding: "utf-8" });

    // Update index
    const indexEntry: IndexEntry = {
      id: entry.id,
      preview: content.slice(0, 200),
      keywords: extractKeywords(content),
      tags: entry.tags,
      timestamp: entry.timestamp,
    };
    this.index.entries.push(indexEntry);
    await this.saveIndex();

    return entry;
  }

  /**
   * Archive a batch of conversation messages.
   */
  async archiveConversation(
    messages: Array<{
      role: string;
      content: string;
      toolName?: string;
    }>,
    sessionId: string,
    startTurn: number,
  ): Promise<number> {
    let archived = 0;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.content || msg.content.length < 10) continue;

      const role = msg.role as MemoryEntry["metadata"]["role"];
      const tags = ["conversation"];
      if (msg.toolName) tags.push(`tool:${msg.toolName}`);
      if (role === "user") tags.push("user-input");
      if (role === "assistant") tags.push("agent-response");

      await this.archive(msg.content, {
        tags,
        sessionId,
        turnNumber: startTurn + Math.floor(i / 3), // rough turn estimate
        role,
        source: "conversation",
      });
      archived++;
    }
    return archived;
  }

  /**
   * Search memory by keyword matching.
   * Returns results sorted by relevance score.
   */
  async search(query: string, limit: number = 10, tags?: string[]): Promise<SearchResult[]> {
    await this.ensureLoaded();

    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) return [];

    const results: SearchResult[] = [];

    for (const idxEntry of this.index.entries) {
      // Tag filter
      if (tags && tags.length > 0) {
        const hasTag = tags.some((t) => idxEntry.tags.includes(t));
        if (!hasTag) continue;
      }

      const matchedKeywords: string[] = [];
      let score = 0;

      for (const qk of queryKeywords) {
        // Exact keyword match
        if (idxEntry.keywords.includes(qk)) {
          matchedKeywords.push(qk);
          score += 3;
        }
        // Partial match (keyword contains query term or vice versa)
        else if (idxEntry.keywords.some((k) => k.includes(qk) || qk.includes(k))) {
          matchedKeywords.push(qk);
          score += 1;
        }
        // Preview text match
        else if (idxEntry.preview.toLowerCase().includes(qk)) {
          matchedKeywords.push(qk);
          score += 0.5;
        }
      }

      if (score > 0) {
        // Boost by recency (newer entries get slight boost)
        const ageMs = Date.now() - new Date(idxEntry.timestamp).getTime();
        const recencyBoost = Math.max(0, 1 - ageMs / (30 * 24 * 60 * 60 * 1000)); // 30-day decay
        score += recencyBoost;

        // We need to load the full entry
        const entry = await this.loadEntry(idxEntry.id);
        if (entry) {
          results.push({ entry, score, matchedKeywords });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get a specific entry by ID.
   */
  async get(id: string): Promise<MemoryEntry | null> {
    return this.loadEntry(id);
  }

  /**
   * List all entries with optional pagination.
   */
  async list(limit: number = 50, offset: number = 0): Promise<IndexEntry[]> {
    await this.ensureLoaded();
    return this.index.entries.slice(offset, offset + limit);
  }

  /**
   * Get total entry count.
   */
  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.index.entries.length;
  }

  /**
   * Delete an entry by ID (marks as deleted in index).
   * The JSONL entry remains for audit but is removed from search.
   */
  async deleteEntry(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const idx = this.index.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;

    this.index.entries.splice(idx, 1);
    await this.saveIndex();
    return true;
  }

  /**
   * Clear all memory (dangerous).
   */
  async clear(): Promise<number> {
    await this.ensureLoaded();
    const count = this.index.entries.length;
    this.index = { entries: [] };
    await this.saveIndex();
    try {
      await writeFile(this.entriesPath, "", "utf-8");
    } catch { /* ok */ }
    return count;
  }

  /**
   * Get memory statistics.
   */
  async stats(): Promise<{
    totalEntries: number;
    totalTags: string[];
    bySource: Record<string, number>;
    byRole: Record<string, number>;
  }> {
    await this.ensureLoaded();

    const tagSet = new Set<string>();
    const bySource: Record<string, number> = {};
    const byRole: Record<string, number> = {};

    for (const entry of this.index.entries) {
      for (const tag of entry.tags) {
        tagSet.add(tag);
        if (tag.startsWith("tool:")) {
          bySource["tool-call"] = (bySource["tool-call"] ?? 0) + 1;
        }
      }
    }

    return {
      totalEntries: this.index.entries.length,
      totalTags: [...tagSet],
      bySource,
      byRole,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async loadEntry(id: string): Promise<MemoryEntry | null> {
    try {
      const raw = await readFile(this.entriesPath, "utf-8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as MemoryEntry;
          if (entry.id === id) return entry;
        } catch { /* skip corrupt lines */ }
      }
    } catch { /* file doesn't exist */ }
    return null;
  }

  private async saveIndex(): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(this.index, null, 2), "utf-8");
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _store: ArchivalMemoryStore | null = null;

export function getArchivalMemoryStore(): ArchivalMemoryStore {
  if (!_store) {
    _store = new ArchivalMemoryStore();
  }
  return _store;
}

/** Reset singleton for testing */
export function resetArchivalMemoryStore(): void {
  _store = null;
}
