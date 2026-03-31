import { watch, type FSWatcher } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { useEffect, useSyncExternalStore } from "react";
import { SessionManager, type SessionSummary } from "../../context/sessions.js";

export interface SessionSummarySnapshot {
  projectRoot: string;
  sessions: SessionSummary[];
  latestSameProject: SessionSummary | null;
}

const EMPTY_SNAPSHOT: SessionSummarySnapshot = {
  projectRoot: "",
  sessions: [],
  latestSameProject: null,
};

const SESSIONS_DIR = join(homedir(), ".jim", "sessions");
const POLL_MS = 5000;
const DEBOUNCE_MS = 80;

class SessionSummaryStore {
  private snapshot: SessionSummarySnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private projectRoot = "";
  private subscriberCount = 0;
  private loading: Promise<void> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.subscriberCount += 1;
    if (this.subscriberCount === 1) {
      this.start();
    }
    return () => {
      this.listeners.delete(listener);
      this.subscriberCount -= 1;
      if (this.subscriberCount === 0) {
        this.stop();
      }
    };
  };

  getSnapshot = (): SessionSummarySnapshot => this.snapshot;

  setProjectRoot(projectRoot: string): void {
    if (projectRoot === this.projectRoot) {
      return;
    }
    this.projectRoot = projectRoot;
    void this.refresh();
  }

  private start(): void {
    try {
      this.watcher = watch(SESSIONS_DIR, () => this.scheduleRefresh());
      this.watcher.unref();
    } catch {
      this.watcher = null;
    }
    void this.refresh();
  }

  private stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.pollTimer = null;
    this.debounceTimer = null;
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.refresh(), DEBOUNCE_MS);
    this.debounceTimer.unref();
  }

  private async refresh(): Promise<void> {
    if (!this.projectRoot) {
      return;
    }
    if (this.loading) {
      await this.loading;
      return;
    }

    this.loading = (async () => {
      const manager = new SessionManager(this.projectRoot);
      const sessions = await manager.list(this.projectRoot);
      const latestSameProject = sessions.find((session) => session.sameProject) ?? null;
      const nextSnapshot: SessionSummarySnapshot = {
        projectRoot: this.projectRoot,
        sessions,
        latestSameProject,
      };

      if (JSON.stringify(nextSnapshot) !== JSON.stringify(this.snapshot)) {
        this.snapshot = nextSnapshot;
        for (const listener of this.listeners) {
          listener();
        }
      }

      if (this.pollTimer) clearTimeout(this.pollTimer);
      this.pollTimer = setTimeout(() => void this.refresh(), POLL_MS);
      this.pollTimer.unref();
    })();

    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }
}

const sessionSummaryStore = new SessionSummaryStore();

export function useSessionSummarySnapshot(projectRoot: string): SessionSummarySnapshot {
  useEffect(() => {
    sessionSummaryStore.setProjectRoot(projectRoot);
  }, [projectRoot]);

  return useSyncExternalStore(sessionSummaryStore.subscribe, sessionSummaryStore.getSnapshot, sessionSummaryStore.getSnapshot);
}
