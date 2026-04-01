import fs from "fs/promises";
import path from "path";

export type TaskStatus =
  | "todo"
  | "in-progress"
  | "done"
  | "blocked"
  | "stopped";

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  owner?: string;
  dependencies?: string[];
  createdAt: number;
  updatedAt: number;
  output?: string;
  stoppedAt?: number;
}

export class TaskManager {
  private tasksPath: string;
  private tasks: Task[] = [];

  constructor(workspaceDir: string) {
    this.tasksPath = path.join(workspaceDir, ".jim", "tasks", "tasks.json");
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.tasksPath), { recursive: true });
      const data = await fs.readFile(this.tasksPath, "utf-8");
      this.tasks = JSON.parse(data);
    } catch {
      this.tasks = [];
      await this.save();
    }
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.tasksPath, JSON.stringify(this.tasks, null, 2));
  }

  async createTask(
    description: string,
    owner?: string,
    dependencies?: string[],
  ): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description,
      status: "todo",
      owner,
      dependencies,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.push(task);
    await this.save();
    return task;
  }

  async updateTask(
    id: string,
    updates: Partial<
      Pick<Task, "status" | "owner" | "description" | "dependencies">
    >,
  ): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;

    Object.assign(task, { ...updates, updatedAt: Date.now() });
    await this.save();
    return task;
  }

  async listTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.find((t) => t.id === id) || null;
  }

  async stopTask(id: string, output?: string): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;

    task.status = "stopped";
    task.stoppedAt = Date.now();
    if (output) task.output = output;
    task.updatedAt = Date.now();
    await this.save();
    return task;
  }

  async getTaskOutput(id: string): Promise<string | null> {
    const task = this.tasks.find((t) => t.id === id);
    return task?.output || null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== initialLen) {
      await this.save();
      return true;
    }
    return false;
  }

  formatTaskList(): string {
    if (this.tasks.length === 0) return "No tasks found.";

    return this.tasks
      .map((t) => {
        const statusIcon =
          t.status === "done"
            ? "✅"
            : t.status === "blocked"
              ? "❌"
              : t.status === "in-progress"
                ? "⏳"
                : "⬜";
        const ownerStr = t.owner ? ` (@${t.owner})` : "";
        const depsStr =
          t.dependencies && t.dependencies.length > 0
            ? ` [Depends on: ${t.dependencies.join(", ")}]`
            : "";
        return `${statusIcon} [${t.id}] ${t.description}${ownerStr}${depsStr}`;
      })
      .join("\n");
  }
}
