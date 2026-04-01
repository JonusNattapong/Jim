import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { childLogger } from "../utils/logger.js";

export interface Plan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  approved: boolean;
  createdAt: string;
  approvedAt?: string;
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  approvedPrompts?: string[];
}

export interface PlanModeState {
  isActive: boolean;
  currentPlan?: Plan;
  hasExited: boolean;
  needsApproval: boolean;
}

/**
 * Manages plan mode state and plan persistence.
 */
export class PlanManager {
  private state: PlanModeState = { isActive: false, hasExited: false, needsApproval: false };
  private plansDir: string;
  private log = childLogger({ component: "PlanManager" });

  constructor(projectRoot: string) {
    this.plansDir = join(projectRoot, ".jim", "plans");
    this.ensurePlansDir();
  }

  /**
   * Enter plan mode.
   */
  async enterPlanMode(): Promise<{ success: boolean; message: string }> {
    if (this.state.isActive) {
      return { success: false, message: "Already in plan mode" };
    }

    this.state = {
      isActive: true,
      hasExited: false,
      needsApproval: false,
    };

    this.log.info("Entered plan mode");

    return {
      success: true,
      message:
        "Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.\n\n" +
        "In plan mode:\n" +
        "1. Thoroughly explore the codebase to understand existing patterns\n" +
        "2. Identify similar features and architectural approaches\n" +
        "3. Consider multiple approaches and their trade-offs\n" +
        "4. Use AskUserQuestion if you need to clarify the approach\n" +
        "5. Design a concrete implementation strategy\n" +
        "6. When ready, use ExitPlanMode to present your plan for approval\n\n" +
        "Remember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.",
    };
  }

  /**
   * Exit plan mode with a plan for approval.
   */
  async exitPlanMode(planContent: string, title?: string): Promise<{
    success: boolean;
    message: string;
    plan?: Plan;
    filePath?: string;
  }> {
    if (!this.state.isActive) {
      return { success: false, message: "Not in plan mode" };
    }

    const plan: Plan = {
      id: randomUUID(),
      title: title || `Plan ${new Date().toISOString().split("T")[0]}`,
      description: planContent,
      steps: this.parseStepsFromContent(planContent),
      approved: false,
      createdAt: new Date().toISOString(),
    };

    const filePath = await this.savePlan(plan);

    this.state = {
      isActive: false,
      currentPlan: plan,
      hasExited: true,
      needsApproval: true,
    };

    this.log.info(`Exited plan mode with plan: ${plan.id}`);

    return {
      success: true,
      message: `Plan saved to ${filePath}. Waiting for user approval before proceeding.`,
      plan,
      filePath,
    };
  }

  /**
   * Approve the current plan.
   */
  async approvePlan(planId?: string): Promise<{ success: boolean; message: string }> {
    const plan = this.state.currentPlan;
    if (!plan) {
      return { success: false, message: "No plan to approve" };
    }

    if (planId && plan.id !== planId) {
      return { success: false, message: "Plan ID mismatch" };
    }

    plan.approved = true;
    plan.approvedAt = new Date().toISOString();
    await this.savePlan(plan);

    this.state.needsApproval = false;

    this.log.info(`Plan approved: ${plan.id}`);

    return {
      success: true,
      message: "Plan approved. You can now proceed with implementation.",
    };
  }

  /**
   * Reject the current plan.
   */
  async rejectPlan(reason: string): Promise<{ success: boolean; message: string }> {
    if (!this.state.currentPlan) {
      return { success: false, message: "No plan to reject" };
    }

    this.state.needsApproval = false;

    this.log.info(`Plan rejected: ${this.state.currentPlan.id}, reason: ${reason}`);

    return {
      success: true,
      message: `Plan rejected. ${reason}`,
    };
  }

  /**
   * Get current plan mode state.
   */
  getState(): PlanModeState {
    return { ...this.state };
  }

  /**
   * Check if currently in plan mode.
   */
  isInPlanMode(): boolean {
    return this.state.isActive;
  }

  /**
   * Check if there's a plan awaiting approval.
   */
  isAwaitingApproval(): boolean {
    return this.state.needsApproval;
  }

  /**
   * Get the current plan.
   */
  getCurrentPlan(): Plan | undefined {
    return this.state.currentPlan;
  }

  /**
   * List all saved plans.
   */
  async listPlans(): Promise<Plan[]> {
    try {
      const files = await import("node:fs/promises").then((fs) => fs.readdir(this.plansDir));
      const plans: Plan[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = await readFile(join(this.plansDir, file), "utf-8");
            plans.push(JSON.parse(content));
          } catch {
            // Skip invalid files
          }
        }
      }

      return plans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  /**
   * Load a plan by ID.
   */
  async loadPlan(planId: string): Promise<Plan | null> {
    try {
      const content = await readFile(join(this.plansDir, `${planId}.json`), "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save plan to disk.
   */
  private async savePlan(plan: Plan): Promise<string> {
    await this.ensurePlansDir();
    const filePath = join(this.plansDir, `${plan.id}.json`);
    await writeFile(filePath, JSON.stringify(plan, null, 2));
    return filePath;
  }

  /**
   * Ensure plans directory exists.
   */
  private async ensurePlansDir(): Promise<void> {
    if (!existsSync(this.plansDir)) {
      await mkdir(this.plansDir, { recursive: true });
    }
  }

  /**
   * Parse steps from plan content.
   */
  private parseStepsFromContent(content: string): PlanStep[] {
    const steps: PlanStep[] = [];
    const lines = content.split("\n");
    let stepId = 0;

    for (const line of lines) {
      // Look for numbered items or bullet points
      const match = line.match(/^\s*(?:\d+[.):-]|[-*])\s*(.+)/);
      if (match) {
        stepId++;
        steps.push({
          id: `step-${stepId}`,
          description: match[1].trim(),
          status: "pending",
        });
      }
    }

    return steps;
  }
}

/**
 * Create a plan manager instance.
 */
export function createPlanManager(projectRoot: string): PlanManager {
  return new PlanManager(projectRoot);
}
