import { readFile, writeFile, mkdir, readdir, unlink, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatCompletionMessageParam[];
  model: string;
  projectRoot: string;
  turnCount: number;
  tags?: string[];
  /** Persisted memory facts */
  memoryFacts?: string[];
  /** Permission mode at save time */
  permissionMode?: string;
  /** Work mode at save time */
  workMode?: string;
}

export interface CheckpointData {
  id: string;
  sessionId: string;
  label: string;
  createdAt: string;
  turnCount: number;
  messageCount: number;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  projectRoot: string;
  sameProject?: boolean;
  lastMessage?: string;
  lastMessageRole?: "user" | "assistant" | "system";
  lastMessageSnippet?: string;
}

function summarizeSnippet(content: string, max = 160): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 3)}...`;
}

function extractLastMessageMetadata(messages: ChatCompletionMessageParam[]): Pick<SessionSummary, "lastMessage" | "lastMessageRole" | "lastMessageSnippet"> {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object" || !("content" in message)) {
      continue;
    }

    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      const normalized = content.trim();
      return {
        lastMessage: normalized,
        lastMessageRole: message.role === "assistant" || message.role === "system" ? message.role : "user",
        lastMessageSnippet: summarizeSnippet(normalized),
      };
    }
  }

  return {};
}

/**
 * Persists conversation sessions to disk with checkpoint support.
 * Sessions are saved in ~/.jim/sessions/ directory.
 * Checkpoints are saved in ~/.jim/checkpoints/ directory.
 */
export class SessionManager {
  private sessionsDir: string;
  private checkpointsDir: string;

  constructor(_unused_projectRoot: string) {
    const jimDir = resolve(homedir(), ".jim");
    this.sessionsDir = join(jimDir, "sessions");
    this.checkpointsDir = join(jimDir, "checkpoints");
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    await mkdir(this.checkpointsDir, { recursive: true });
  }

  async save(session: SessionData): Promise<void> {
    await this.ensureDir();
    const filePath = join(this.sessionsDir, `${session.id}.json`);
    session.updatedAt = new Date().toISOString();
    await writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  }

  async load(sessionId: string): Promise<SessionData | null> {
    try {
      const filePath = join(this.sessionsDir, `${sessionId}.json`);
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as SessionData;
    } catch {
      return null;
    }
  }

  async list(projectRoot?: string): Promise<SessionSummary[]> {
    try {
      await this.ensureDir();
      const files = await readdir(this.sessionsDir);
      const sessions: SessionSummary[] = [];

      for (const file of files.sort().reverse()) {
        if (file.endsWith(".json")) {
          try {
            const data = await this.load(file.replace(".json", ""));
            if (data) {
              const lastMessage = extractLastMessageMetadata(data.messages);
              sessions.push({
                id: data.id,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                turnCount: data.turnCount,
                projectRoot: data.projectRoot,
                sameProject: projectRoot ? data.projectRoot === projectRoot : undefined,
                ...lastMessage,
              });
            }
          } catch { /* skip corrupt files */ }
        }
      }

      if (!projectRoot) {
        return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }

      return sessions.sort((a, b) => {
        const aSame = a.sameProject ? 1 : 0;
        const bSame = b.sameProject ? 1 : 0;
        if (aSame !== bSame) {
          return bSame - aSame;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    } catch {
      return [];
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      const filePath = join(this.sessionsDir, `${sessionId}.json`);
      await unlink(filePath);

      // Also delete associated checkpoints
      const checkpoints = await this.listCheckpoints(sessionId);
      for (const cp of checkpoints) {
        try { await this.deleteCheckpoint(sessionId, cp.id); } catch { /* non-fatal */ }
      }

      return true;
    } catch {
      return false;
    }
  }

  generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // --- Checkpoint methods ---

  async createCheckpoint(sessionId: string, label: string): Promise<CheckpointData | null> {
    const session = await this.load(sessionId);
    if (!session) return null;

    await this.ensureDir();

    const checkpointId = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const checkpoint: CheckpointData = {
      id: checkpointId,
      sessionId,
      label,
      createdAt: new Date().toISOString(),
      turnCount: session.turnCount,
      messageCount: session.messages.length,
    };

    // Save checkpoint metadata
    const metaPath = join(this.checkpointsDir, `${sessionId}__${checkpointId}.meta.json`);
    await writeFile(metaPath, JSON.stringify(checkpoint, null, 2), "utf-8");

    // Save full session snapshot
    const dataPath = join(this.checkpointsDir, `${sessionId}__${checkpointId}.data.json`);
    await writeFile(dataPath, JSON.stringify(session, null, 2), "utf-8");

    return checkpoint;
  }

  async listCheckpoints(sessionId: string): Promise<CheckpointData[]> {
    try {
      await this.ensureDir();
      const files = await readdir(this.checkpointsDir);
      const prefix = `${sessionId}__`;
      const checkpoints: CheckpointData[] = [];

      for (const file of files) {
        if (file.startsWith(prefix) && file.endsWith(".meta.json")) {
          try {
            const content = await readFile(join(this.checkpointsDir, file), "utf-8");
            checkpoints.push(JSON.parse(content) as CheckpointData);
          } catch { /* skip corrupt */ }
        }
      }

      return checkpoints.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch {
      return [];
    }
  }

  async restoreCheckpoint(sessionId: string, checkpointId: string): Promise<SessionData | null> {
    try {
      const dataPath = join(this.checkpointsDir, `${sessionId}__${checkpointId}.data.json`);
      const content = await readFile(dataPath, "utf-8");
      const session = JSON.parse(content) as SessionData;

      // Overwrite current session with checkpoint data
      await this.save(session);
      return session;
    } catch {
      return null;
    }
  }

  async deleteCheckpoint(sessionId: string, checkpointId: string): Promise<boolean> {
    try {
      const metaPath = join(this.checkpointsDir, `${sessionId}__${checkpointId}.meta.json`);
      const dataPath = join(this.checkpointsDir, `${sessionId}__${checkpointId}.data.json`);
      try { await unlink(metaPath); } catch { /* non-fatal */ }
      try { await unlink(dataPath); } catch { /* non-fatal */ }
      return true;
    } catch {
      return false;
    }
  }
}
