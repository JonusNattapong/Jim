import { useSyncExternalStore } from "react";
import type { ToolCallEntry } from "../components/ToolActivity.js";
import { parseTaskBoard, type TaskBoardData } from "../components/TaskBoard.js";

export interface TaskStatusSnapshot {
  runningCount: number;
  pendingApprovalCount: number;
  awaitingChoiceCount: number;
  completedCount: number;
  latestBoard: TaskBoardData | null;
}

const EMPTY_SNAPSHOT: TaskStatusSnapshot = {
  runningCount: 0,
  pendingApprovalCount: 0,
  awaitingChoiceCount: 0,
  completedCount: 0,
  latestBoard: null,
};

class TaskStatusStore {
  private snapshot: TaskStatusSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TaskStatusSnapshot => this.snapshot;

  update(calls: ToolCallEntry[]): void {
    const latestBoard = [...calls]
      .reverse()
      .map((call) => (call.name === "todo_write" && call.rawResult ? parseTaskBoard(call.rawResult) : null))
      .find((board): board is TaskBoardData => board !== null) ?? null;

    const nextSnapshot: TaskStatusSnapshot = {
      runningCount: calls.filter((call) => call.status === "running").length,
      pendingApprovalCount: calls.filter((call) => call.status === "pending_approval").length,
      awaitingChoiceCount: calls.filter((call) => call.status === "awaiting_choice").length,
      completedCount: calls.filter((call) => call.status === "done").length,
      latestBoard,
    };

    if (JSON.stringify(nextSnapshot) === JSON.stringify(this.snapshot)) {
      return;
    }

    this.snapshot = nextSnapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const taskStatusStore = new TaskStatusStore();

export function updateTaskStatusStore(calls: ToolCallEntry[]): void {
  taskStatusStore.update(calls);
}

export function useTaskStatusSnapshot(): TaskStatusSnapshot {
  return useSyncExternalStore(taskStatusStore.subscribe, taskStatusStore.getSnapshot, taskStatusStore.getSnapshot);
}
