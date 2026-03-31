/**
 * Session Memory Manager
 *
 * Simple session memory extraction and persistence utility.
 * Extracts lightweight facts from turns (messages + tool results) and
 * persists them to a session-specific JSON file. Designed to be
 * conservative and dependency-free so it can run in most environments.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { childLogger } from "../utils/logger.js";

export interface SessionMemoryItem {
  id: string;
  sessionId: string;
  createdAt: number;
  source: string; // 'user' | 'tool' | 'system' | custom
  type: string; // e.g. 'profile' | 'preference' | 'file' | 'todo' | 'url'
  content: string;
  tags?: string[];
  relevance?: number; // 0.0 - 1.0
  metadata?: Record<string, unknown>;
}

export interface SessionMemoryOptions {
  storageDir?: string;
  autoPersist?: boolean;
  maxEntries?: number;
}

export class SessionMemoryManager {
  private sessionId: string;
  private storageDir: string;
  private memories: SessionMemoryItem[] = [];
  private autoPersist: boolean;
  private maxEntries: number;
  private log = childLogger({ component: "SessionMemoryManager" });

  constructor(sessionId: string, opts?: SessionMemoryOptions) {
    this.sessionId = sessionId;
    const base = opts?.storageDir ?? path.join(process.env.HOME || process.env.USERPROFILE || process.cwd(), ".jim", "sessions", sessionId);
    this.storageDir = base;
    this.autoPersist = opts?.autoPersist ?? true;
    this.maxEntries = opts?.maxEntries ?? 500;
  }

  /** Ensure storage exists and load existing memories */
  async initialize(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await this.load();
  }

  private storageFile(): string {
    return path.join(this.storageDir, "memories.json");
  }

  async addMemory(item: Partial<SessionMemoryItem> | string, source: string = "user", type: string = "fact"): Promise<SessionMemoryItem> {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    const content = typeof item === "string" ? item : item.content ?? "";

    const mem: SessionMemoryItem = {
      id,
      sessionId: this.sessionId,
      createdAt: now,
      source,
      type,
      content,
      tags: typeof item === "string" ? [] : item.tags ?? [],
      relevance: typeof item === "string" ? 0.5 : item.relevance ?? 0.5,
      metadata: typeof item === "string" ? {} : item.metadata ?? {},
    };

    this.memories.push(mem);

    // prune oldest
    if (this.memories.length > this.maxEntries) {
      this.memories.splice(0, this.memories.length - this.maxEntries);
    }

    if (this.autoPersist) {
      try {
        await this.persist();
      } catch (err) {
        this.log.warn({ err: String(err) }, "Failed to persist session memory");
      }
    }

    return mem;
  }

  async persist(): Promise<void> {
    const file = this.storageFile();
    await fs.writeFile(file, JSON.stringify(this.memories, null, 2), "utf8");
  }

  async load(): Promise<void> {
    const file = this.storageFile();
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as SessionMemoryItem[];
      this.memories = parsed.slice(-this.maxEntries);
    } catch (err: unknown) {
      // ignore file-not-found
      const e = err as NodeJS.ErrnoException;
      if (e?.code !== "ENOENT") {
        this.log.warn({ err: String(err) }, "Failed to load session memories");
      }
      this.memories = [];
    }
  }

  getMemories(limit: number = 100): SessionMemoryItem[] {
    return this.memories.slice(-limit).reverse();
  }

  clear(): void {
    this.memories = [];
  }

  /**
   * Basic extraction heuristics from a turn. Returns created memory items.
   * Conservative: avoids hallucination and only picks explicit patterns.
   */
  async extractFromTurn(turn: { messages?: Array<{ role: string; content: string }>; toolResults?: Array<{ toolName?: string; content?: unknown }>; metadata?: Record<string, unknown> } = {}): Promise<SessionMemoryItem[]> {
    const added: SessionMemoryItem[] = [];

    const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const urlRe = /https?:\/\/[^\s)]+/g;
    const fileRe = /(?:[A-Za-z]:\\|\/?)[\w\-.\\\/]+\.(?:ts|js|json|md|py|java|txt|yaml|yml)/g;
    const todoRe = /TODO[:]?\s*(.*)/i;
    const nameRe = /\b(?:My name is|I am|I'm)\s+([A-Z][a-zA-Z\-']+)/i;

    for (const msg of turn.messages ?? []) {
      if (!msg || !msg.content) continue;

      // emails
      const emails = Array.from(new Set((msg.content.match(emailRe) ?? [])));
      for (const e of emails) {
        added.push(await this.addMemory({ content: e, tags: ["email"], relevance: 0.9 }, msg.role, "email"));
      }

      // urls
      const urls = Array.from(new Set((msg.content.match(urlRe) ?? [])));
      for (const u of urls) {
        added.push(await this.addMemory({ content: u, tags: ["url"], relevance: 0.6 }, msg.role, "url"));
      }

      // files
      const files = Array.from(new Set((msg.content.match(fileRe) ?? [])));
      for (const f of files) {
        added.push(await this.addMemory({ content: f, tags: ["file"], relevance: 0.7 }, msg.role, "file"));
      }

      // TODO lines
      const todo = msg.content.match(todoRe);
      if (todo && todo[1]) {
        added.push(await this.addMemory({ content: todo[1].trim(), tags: ["todo"], relevance: 0.8 }, msg.role, "todo"));
      }

      // name patterns
      const name = msg.content.match(nameRe);
      if (name && name[1]) {
        added.push(await this.addMemory({ content: name[1], tags: ["profile", "name"], relevance: 0.95 }, msg.role, "profile"));
      }
    }

    // Tool results: try to capture referenced paths or URLs
    for (const tr of turn.toolResults ?? []) {
      if (!tr || tr.content == null) continue;
      const text = typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content);
      const urls = Array.from(new Set((text.match(urlRe) ?? [])));
      for (const u of urls) {
        added.push(await this.addMemory({ content: u, tags: ["url", (tr.toolName ?? "tool")], relevance: 0.6 }, "tool", "url"));
      }

      const files = Array.from(new Set((text.match(fileRe) ?? [])));
      for (const f of files) {
        added.push(await this.addMemory({ content: f, tags: ["file", (tr.toolName ?? "tool")], relevance: 0.7 }, "tool", "file"));
      }
    }

    return added;
  }

  /** Simple substring search against memories */
  search(q: string, limit = 50): SessionMemoryItem[] {
    const ql = q.toLowerCase();
    return this.memories.filter((m) => m.content.toLowerCase().includes(ql)).slice(-limit).reverse();
  }
}

export default SessionMemoryManager;
