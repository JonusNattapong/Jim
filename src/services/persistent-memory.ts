/**
 * Persistent Memory System
 * 
 * Inspired by Claude Code's memdir system that provides file-based
 * persistent memory across sessions. Stores key information in
 * structured markdown files.
 * 
 * @see https://github.com/anthropics/claude-code
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

// ============================================================================
// Types
// ============================================================================

/**
 * Memory types (closed taxonomy from Claude Code)
 */
export type MemoryType = "user" | "feedback" | "project" | "session";

/**
 * Memory file configuration
 */
export interface MemoryConfig {
  /** Base directory for memories */
  baseDir: string;
  /** Maximum lines in main MEMORY.md */
  maxMainMemoryLines: number;
  /** Maximum size in KB for main memory */
  maxMainMemorySizeKb: number;
  /** Whether to enable team memories */
  enableTeamMemories: boolean;
  /** Whether to enable daily logs */
  enableDailyLogs: boolean;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  type: MemoryType;
  content: string;
  filePath: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory file structure
 */
export interface MemoryFile {
  path: string;
  type: MemoryType;
  content: string;
  lastModified: number;
  sizeBytes: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MemoryConfig = {
  baseDir: "",
  maxMainMemoryLines: 200,
  maxMainMemorySizeKb: 25,
  enableTeamMemories: false,
  enableDailyLogs: false,
};

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Sanitize git root for use in file paths
 */
function sanitizeGitRoot(gitRoot: string): string {
  return gitRoot
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Get memory directory for a project
 */
function getMemoryDir(projectRoot: string): string {
  const sanitized = sanitizeGitRoot(projectRoot);
  return path.join(projectRoot, ".jim", "memory", sanitized);
}

/**
 * Get main memory file path
 */
function getMainMemoryPath(memoryDir: string): string {
  return path.join(memoryDir, "MEMORY.md");
}

/**
 * Get topic memory file path
 */
function getTopicMemoryPath(memoryDir: string, topic: string): string {
  const sanitized = topic.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  return path.join(memoryDir, `${sanitized}.md`);
}

/**
 * Get team memory directory
 */
function getTeamMemoryDir(memoryDir: string): string {
  return path.join(memoryDir, "team");
}

/**
 * Get daily log path
 */
function getDailyLogPath(memoryDir: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return path.join(
    memoryDir,
    "logs",
    String(year),
    month,
    `${year}-${month}-${day}.md`
  );
}

// ============================================================================
// Memory Manager
// ============================================================================

/**
 * Manages persistent memory across sessions
 */
export class PersistentMemoryManager {
  private config: MemoryConfig;
  private memoryDir: string;
  private isInitialized = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryDir = "";
  }

  /**
   * Initialize memory for a project
   */
  async initialize(projectRoot: string): Promise<void> {
    this.memoryDir = getMemoryDir(projectRoot);
    await fs.mkdir(this.memoryDir, { recursive: true });
    this.isInitialized = true;
  }

  /**
   * Load main MEMORY.md
   */
  async loadMainMemory(): Promise<string | null> {
    const filePath = getMainMemoryPath(this.memoryDir);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Save to main MEMORY.md
   */
  async saveMainMemory(content: string): Promise<void> {
    const filePath = getMainMemoryPath(this.memoryDir);
    
    // Check size limits
    const lines = content.split("\n");
    if (lines.length > this.config.maxMainMemoryLines) {
      content = lines.slice(-this.config.maxMainMemoryLines).join("\n");
    }

    const sizeKb = Buffer.byteLength(content, "utf-8") / 1024;
    if (sizeKb > this.config.maxMainMemorySizeKb) {
      const maxBytes = this.config.maxMainMemorySizeKb * 1024;
      content = Buffer.from(content, "utf-8").subarray(0, maxBytes).toString("utf-8");
    }

    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * Append to main MEMORY.md
   */
  async appendToMainMemory(content: string): Promise<void> {
    const existing = await this.loadMainMemory();
    const newContent = existing ? `${existing}\n${content}` : content;
    await this.saveMainMemory(newContent);
  }

  /**
   * Load a topic-specific memory
   */
  async loadTopicMemory(topic: string): Promise<string | null> {
    const filePath = getTopicMemoryPath(this.memoryDir, topic);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Save a topic-specific memory
   */
  async saveTopicMemory(topic: string, content: string): Promise<void> {
    const filePath = getTopicMemoryPath(this.memoryDir, topic);
    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * List all memory files
   */
  async listMemoryFiles(): Promise<MemoryFile[]> {
    const files: MemoryFile[] = [];

    try {
      const entries = await fs.readdir(this.memoryDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const filePath = path.join(this.memoryDir, entry.name);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");

          let type: MemoryType = "session";
          if (entry.name === "MEMORY.md") type = "user";
          else if (entry.name.includes("feedback")) type = "feedback";
          else if (entry.name.includes("project")) type = "project";

          files.push({
            path: filePath,
            type,
            content,
            lastModified: stats.mtimeMs,
            sizeBytes: stats.size,
          });
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return files;
  }

  /**
   * Search memories by keyword
   */
  async searchMemories(query: string): Promise<MemoryEntry[]> {
    const files = await this.listMemoryFiles();
    const lowerQuery = query.toLowerCase();
    const results: MemoryEntry[] = [];

    for (const file of files) {
      if (file.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: file.type,
          content: file.content,
          filePath: file.path,
          timestamp: file.lastModified,
        });
      }
    }

    return results;
  }

  /**
   * Delete a memory file
   */
  async deleteMemory(topic: string): Promise<boolean> {
    const filePath = getTopicMemoryPath(this.memoryDir, topic);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSizeKb: number;
    byType: Record<MemoryType, number>;
  }> {
    const files = await this.listMemoryFiles();
    const byType: Record<MemoryType, number> = {
      user: 0,
      feedback: 0,
      project: 0,
      session: 0,
    };

    let totalSizeBytes = 0;

    for (const file of files) {
      byType[file.type]++;
      totalSizeBytes += file.sizeBytes;
    }

    return {
      totalFiles: files.length,
      totalSizeKb: Math.round(totalSizeBytes / 1024),
      byType,
    };
  }

  /**
   * Export memories to a single markdown string
   */
  async exportMemories(): Promise<string> {
    const files = await this.listMemoryFiles();
    const parts: string[] = [];

    for (const file of files) {
      parts.push(`## ${path.basename(file.path)}\n`);
      parts.push(file.content);
      parts.push("\n---\n");
    }

    return parts.join("\n");
  }

  /**
   * Check if memory exists
   */
  async hasMemory(topic: string): Promise<boolean> {
    const content = await this.loadTopicMemory(topic);
    return content !== null;
  }

  /**
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    try {
      await fs.rm(this.memoryDir, { recursive: true, force: true });
      await fs.mkdir(this.memoryDir, { recursive: true });
    } catch {
      // Directory doesn't exist
    }
  }
}

// ============================================================================
// Memory Prompt Generation
// ============================================================================

/**
 * Generate system prompt for memory loading
 */
export function generateMemoryPrompt(memories: string[]): string {
  if (memories.length === 0) return "";

  return `## Persistent Memory

The following information was remembered from previous sessions:

${memories.map((m, i) => `### Memory ${i + 1}\n${m}`).join("\n\n")}

Use this context to provide more personalized and consistent responses.`;
}

/**
 * Generate extraction prompt for memory creation
 */
export function generateExtractionPrompt(): string {
  return `Analyze this conversation and extract information that should be remembered for future sessions.

Focus on:
1. **User Preferences**: How they like things done, communication style
2. **Project Context**: Important constraints, architecture decisions
3. **TODOs**: Tasks mentioned but not completed
4. **Feedback**: Any corrections or guidance given

Output as JSON:
{
  "user": "User preferences and role information",
  "project": "Project-specific context",
  "feedback": "Behavioral guidance received",
  "session": "Session-specific notes"
}

Only extract HIGH-VALUE information that would improve future interactions.`;
}

// ============================================================================
// Exports
// ============================================================================

export const PersistentMemory = {
  PersistentMemoryManager,
  generateMemoryPrompt,
  generateExtractionPrompt,
  getMemoryDir,
  sanitizeGitRoot,
} as const;