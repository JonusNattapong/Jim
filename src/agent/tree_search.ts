import { exec } from "node:child_process";
import { promisify } from "node:util";
import { childLogger } from "../utils/logger.js";

const execAsync = promisify(exec);

export interface TreeNode {
  id: string;
  parentId: string | null;
  action: string;
  description: string;
  score: number;
  visits: number;
  children: TreeNode[];
  result?: SimulationResult;
  depth: number;
}

export interface SimulationResult {
  success: boolean;
  testOutput: string;
  exitCode: number;
  score: number;
  errorPatterns: string[];
  durationMs: number;
}

export interface TreeSearchConfig {
  maxSimulations: number;
  explorationConstant: number;
  testCommand: string;
  projectRoot: string;
  maxDepth: number;
}

export interface TreeSearchResult {
  bestPath: TreeNode[];
  bestScore: number;
  simulationsRun: number;
  rollbacksPerformed: number;
  summary: string;
}

const DEFAULT_CONFIG: TreeSearchConfig = {
  maxSimulations: 3,
  explorationConstant: 1.41,
  testCommand: "",
  projectRoot: process.cwd(),
  maxDepth: 4,
};

export class TreeSearchEngine {
  private root: TreeNode;
  private config: TreeSearchConfig;
  private log;
  private simulationCount = 0;
  private rollbackCount = 0;
  private stashedAt: string | null = null;

  constructor(config: Partial<TreeSearchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = childLogger({ component: "tree-search" });
    this.root = this.createNode(null, "root", "Initial state", 0);
  }

  private createNode(parentId: string | null, action: string, description: string, depth: number): TreeNode {
    return {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parentId,
      action,
      description,
      score: 0,
      visits: 0,
      children: [],
      depth,
    };
  }

  getRoot(): TreeNode {
    return this.root;
  }

  getSimulationCount(): number {
    return this.simulationCount;
  }

  getRollbackCount(): number {
    return this.rollbackCount;
  }

  async createSnapshot(): Promise<boolean> {
    try {
      await execAsync("git add -A", { cwd: this.config.projectRoot });
      const stashResult = await execAsync("git stash push -m 'jim-tree-search-snapshot'", {
        cwd: this.config.projectRoot,
      });
      this.stashedAt = stashResult.stdout.trim();
      this.log.debug("Git snapshot created");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ err: msg }, "Failed to create git snapshot");
      return false;
    }
  }

  async rollbackToSnapshot(): Promise<boolean> {
    try {
      if (this.stashedAt) {
        await execAsync("git checkout -- .", { cwd: this.config.projectRoot });
        await execAsync("git clean -fd", { cwd: this.config.projectRoot });
        try {
          await execAsync("git stash pop", { cwd: this.config.projectRoot });
        } catch {
          // stash may already be applied
        }
      } else {
        await execAsync("git checkout -- .", { cwd: this.config.projectRoot });
        await execAsync("git clean -fd", { cwd: this.config.projectRoot });
      }
      this.rollbackCount++;
      this.log.debug("Rollback completed");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ err: msg }, "Rollback failed");
      return false;
    }
  }

  async simulate(action: string, description: string, testCmd?: string): Promise<SimulationResult> {
    const start = Date.now();
    this.simulationCount++;
    const cmd = testCmd || this.config.testCommand;

    if (!cmd) {
      return {
        success: false,
        testOutput: "No test command configured for simulation",
        exitCode: -1,
        score: 0,
        errorPatterns: ["NO_TEST_COMMAND"],
        durationMs: Date.now() - start,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.config.projectRoot,
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      });
      const output = [stdout, stderr].filter(Boolean).join("\n");
      const exitCode = 0;
      const success = exitCode === 0;
      const errorPatterns = this.extractErrorPatterns(output);
      const score = this.calculateScore(success, output, errorPatterns);

      return {
        success,
        testOutput: output.slice(0, 3000),
        exitCode,
        score,
        errorPatterns,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
      const output = [e.stdout, e.stderr].filter(Boolean).join("\n") || e.message || "Unknown error";
      const exitCode = e.code ?? -1;
      const errorPatterns = this.extractErrorPatterns(output);
      const score = this.calculateScore(false, output, errorPatterns);

      return {
        success: false,
        testOutput: output.slice(0, 3000),
        exitCode,
        score,
        errorPatterns,
        durationMs: Date.now() - start,
      };
    }
  }

  private extractErrorPatterns(output: string): string[] {
    const patterns: string[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (/FAIL|ERROR|TypeError|ReferenceError|SyntaxError|AssertionError/i.test(trimmed)) {
        const errorLine = trimmed.slice(0, 200);
        if (!patterns.includes(errorLine)) {
          patterns.push(errorLine);
        }
      }
    }

    return patterns.slice(0, 10);
  }

  private calculateScore(success: boolean, output: string, errorPatterns: string[]): number {
    if (success) {
      const passMatch = output.match(/(\d+)\s+pass/i);
      const failMatch = output.match(/(\d+)\s+fail/i);
      const passes = passMatch ? parseInt(passMatch[1], 10) : 1;
      const fails = failMatch ? parseInt(failMatch[1], 10) : 0;
      return Math.max(0.1, 1 - fails * 0.1) + passes * 0.01;
    }
    return -1 - errorPatterns.length * 0.1;
  }

  private ucb1(node: TreeNode, parentVisits: number): number {
    if (node.visits === 0) return Infinity;
    const exploitation = node.score / node.visits;
    const exploration = this.config.explorationConstant * Math.sqrt(Math.log(parentVisits) / node.visits);
    return exploitation + exploration;
  }

  selectBest(): TreeNode | null {
    let current = this.root;
    while (current.children.length > 0) {
      let bestChild = current.children[0];
      let bestUcb = this.ucb1(bestChild, current.visits);

      for (const child of current.children) {
        const ucb = this.ucb1(child, current.visits);
        if (ucb > bestUcb) {
          bestUcb = ucb;
          bestChild = child;
        }
      }
      current = bestChild;
    }
    return current;
  }

  expand(parentNode: TreeNode, action: string, description: string): TreeNode {
    const child = this.createNode(parentNode.id, action, description, parentNode.depth + 1);
    parentNode.children.push(child);
    return child;
  }

  backpropagate(node: TreeNode, score: number): void {
    let current: TreeNode | null = node;
    while (current) {
      current.visits++;
      current.score += score;
      current = this.findParent(current);
    }
  }

  private findParent(node: TreeNode): TreeNode | null {
    if (!node.parentId) return null;
    return this.findNodeById(this.root, node.parentId);
  }

  private findNodeById(root: TreeNode, id: string): TreeNode | null {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this.findNodeById(child, id);
      if (found) return found;
    }
    return null;
  }

  getBestPath(): TreeNode[] {
    const path: TreeNode[] = [];
    let current = this.root;

    while (current.children.length > 0) {
      let bestChild = current.children[0];
      for (const child of current.children) {
        const avgScore = child.visits > 0 ? child.score / child.visits : 0;
        const bestAvg = bestChild.visits > 0 ? bestChild.score / bestChild.visits : 0;
        if (avgScore > bestAvg) {
          bestChild = child;
        }
      }
      path.push(bestChild);
      current = bestChild;
    }

    return path;
  }

  formatTree(node: TreeNode = this.root, indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    const avgScore = node.visits > 0 ? (node.score / node.visits).toFixed(2) : "N/A";
    const status = node.result ? (node.result.success ? "✅" : "❌") : "⏳";
    let output = `${prefix}${status} ${node.description} (v=${node.visits}, avg=${avgScore})\n`;

    for (const child of node.children) {
      output += this.formatTree(child, indent + 1);
    }

    return output;
  }
}
