import { useSyncExternalStore } from "react";
import { pushPromptHistory } from "../ui-state.js";

export interface PromptHistorySnapshot {
  entries: string[];
}

const EMPTY_SNAPSHOT: PromptHistorySnapshot = {
  entries: [],
};

class PromptHistoryStore {
  private snapshot: PromptHistorySnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PromptHistorySnapshot => this.snapshot;

  initialize(entries: string[]): void {
    if (JSON.stringify(entries) === JSON.stringify(this.snapshot.entries)) {
      return;
    }

    this.snapshot = { entries: [...entries] };
    this.emit();
  }

  push(value: string): string[] {
    const nextEntries = pushPromptHistory(this.snapshot.entries, value);
    if (JSON.stringify(nextEntries) === JSON.stringify(this.snapshot.entries)) {
      return this.snapshot.entries;
    }

    this.snapshot = { entries: nextEntries };
    this.emit();
    return nextEntries;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const promptHistoryStore = new PromptHistoryStore();

export function initializePromptHistoryStore(entries: string[]): void {
  promptHistoryStore.initialize(entries);
}

export function pushPromptHistoryStore(value: string): string[] {
  return promptHistoryStore.push(value);
}

export function usePromptHistorySnapshot(): PromptHistorySnapshot {
  return useSyncExternalStore(promptHistoryStore.subscribe, promptHistoryStore.getSnapshot, promptHistoryStore.getSnapshot);
}
