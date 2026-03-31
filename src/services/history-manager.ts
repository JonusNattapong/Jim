import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface Snapshot {
  id: string;
  filePath: string;
  timestamp: number;
  hash: string;
  originalContent: string;
}

export class HistoryManager {
  private historyPath: string;
  private snapshotsDir: string;

  constructor(workspaceDir: string) {
    this.historyPath = path.join(workspaceDir, ".jim", "history", "index.json");
    this.snapshotsDir = path.join(workspaceDir, ".jim", "history", "snapshots");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.snapshotsDir, { recursive: true });
    try {
      await fs.access(this.historyPath);
    } catch {
      await fs.writeFile(this.historyPath, JSON.stringify([], null, 2));
    }
  }

  /**
   * Create a snapshot of a file before it's modified.
   */
  async takeSnapshot(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const hash = crypto.createHash("md5").update(content).digest("hex");
      const id = `snap-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;
      
      const snapshot: Snapshot = {
        id,
        filePath,
        timestamp: Date.now(),
        hash,
        originalContent: content,
      };

      // Save content to snapshot file
      const snapshotFile = path.join(this.snapshotsDir, `${id}.bak`);
      await fs.writeFile(snapshotFile, content);

      // Update index
      const indexData = await fs.readFile(this.historyPath, "utf-8");
      const index = JSON.parse(indexData);
      index.push({
        id,
        filePath,
        timestamp: snapshot.timestamp,
        hash: snapshot.hash,
        snapshotFile: `${id}.bak`,
      });
      
      // Keep only last 50 snapshots
      if (index.length > 50) {
        const removed = index.shift();
        try { await fs.unlink(path.join(this.snapshotsDir, removed.snapshotFile)); } catch {}
      }

      await fs.writeFile(this.historyPath, JSON.stringify(index, null, 2));
      return id;
    } catch (e) {
      console.error("Failed to take snapshot:", e);
      return null;
    }
  }

  /**
   * Restore a file to its state from a specific snapshot ID.
   */
  async restoreSnapshot(id: string): Promise<boolean> {
    try {
      const indexData = await fs.readFile(this.historyPath, "utf-8");
      const index = JSON.parse(indexData);
      const entry = index.find((e: any) => e.id === id);
      
      if (!entry) return false;

      const snapshotFile = path.join(this.snapshotsDir, entry.snapshotFile);
      const content = await fs.readFile(snapshotFile, "utf-8");
      
      await fs.writeFile(entry.filePath, content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recent history.
   */
  async getHistory(): Promise<any[]> {
    const data = await fs.readFile(this.historyPath, "utf-8");
    return JSON.parse(data);
  }
}
