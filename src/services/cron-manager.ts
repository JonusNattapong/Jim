import fs from "fs/promises";
import path from "path";

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression
  command: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
  updatedAt: number;
}

export class CronManager {
  private cronPath: string;
  private jobs: CronJob[] = [];

  constructor(workspaceDir: string) {
    this.cronPath = path.join(workspaceDir, ".jim", "cron", "jobs.json");
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cronPath), { recursive: true });
      const data = await fs.readFile(this.cronPath, "utf-8");
      this.jobs = JSON.parse(data);
    } catch {
      this.jobs = [];
      await this.save();
    }
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.cronPath, JSON.stringify(this.jobs, null, 2));
  }

  async createJob(
    name: string,
    schedule: string,
    command: string,
  ): Promise<CronJob> {
    const job: CronJob = {
      id: `cron-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      schedule,
      command,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.jobs.push(job);
    await this.save();
    return job;
  }

  async deleteJob(id: string): Promise<boolean> {
    const initialLen = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    if (this.jobs.length !== initialLen) {
      await this.save();
      return true;
    }
    return false;
  }

  async listJobs(): Promise<CronJob[]> {
    return [...this.jobs];
  }

  async getJob(id: string): Promise<CronJob | null> {
    return this.jobs.find((j) => j.id === id) || null;
  }

  async toggleJob(id: string): Promise<CronJob | null> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;

    job.enabled = !job.enabled;
    job.updatedAt = Date.now();
    await this.save();
    return job;
  }

  formatJobList(): string {
    if (this.jobs.length === 0) return "No cron jobs found.";

    return this.jobs
      .map((j) => {
        const statusIcon = j.enabled ? "🟢" : "🔴";
        const lastRunStr = j.lastRun
          ? `Last: ${new Date(j.lastRun).toLocaleString()}`
          : "Never run";
        return `${statusIcon} [${j.id}] ${j.name}\n   Schedule: ${j.schedule}\n   Command: ${j.command}\n   ${lastRunStr}`;
      })
      .join("\n\n");
  }
}
