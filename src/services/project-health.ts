import { execSync, exec } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Project Health Diagnostics
 * Inspects workspace readiness and suggests fixes
 * Adapted from Claude Code's doctor command pattern
 */

export interface HealthCheckResult {
  category: string;
  status: "✅" | "⚠️" | "❌";
  message: string;
  suggestion?: string;
  code?: number; // Exit code equivalent: 0 = pass, 1 = warning, 2 = error
}

export async function runHealthCheck(projectPath: string): Promise<{
  results: HealthCheckResult[];
  healthy: boolean;
  timestamp: number;
}> {
  const results: HealthCheckResult[] = [];

  // 1. Check Node.js version
  results.push(checkNodeVersion());

  // 2. Check package.json
  results.push(checkPackageJson(projectPath));

  // 3. Check dependencies
  await checkDependency(results, "pnpm", "Package manager (pnpm)");
  await checkDependency(results, "git", "Version control (git)");

  // 4. Check environment variables
  results.push(checkEnvironmentVariables());

  // 5. Check required files
  results.push(...checkRequiredFiles(projectPath));

  // 6. Check API keys
  results.push(checkAPIKeys());

  // 7. Check voice dependencies (if voice enabled)
  results.push(await checkVoiceDependencies());

  // 8. Check project structure
  results.push(...checkProjectStructure(projectPath));

  const healthy = results.every((r) => r.code !== 2);

  return { results, healthy, timestamp: Date.now() };
}

function checkNodeVersion(): HealthCheckResult {
  try {
    const version = execSync("node --version", { encoding: "utf-8" })
      .trim()
      .slice(1); // Remove 'v' prefix
    const major = parseInt(version.split(".")[0], 10);

    if (major >= 20) {
      return {
        category: "Node.js",
        status: "✅",
        message: `Node.js ${version} ✓`,
        code: 0,
      };
    }

    return {
      category: "Node.js",
      status: "❌",
      message: `Node.js ${version} is too old`,
      suggestion:
        "Please upgrade to Node.js 20+ (recommended 22+). Visit https://nodejs.org/",
      code: 2,
    };
  } catch (err) {
    return {
      category: "Node.js",
      status: "❌",
      message: "Node.js not found",
      suggestion: "Install Node.js from https://nodejs.org/",
      code: 2,
    };
  }
}

function checkPackageJson(projectPath: string): HealthCheckResult {
  const packagePath = join(projectPath, "package.json");
  if (existsSync(packagePath)) {
    return {
      category: "Project",
      status: "✅",
      message: "package.json found",
      code: 0,
    };
  }

  return {
    category: "Project",
    status: "❌",
    message: "package.json not found",
    suggestion: "Initialize project with: npm init -y or pnpm init",
    code: 2,
  };
}

async function checkDependency(
  results: HealthCheckResult[],
  command: string,
  label: string
): Promise<void> {
  try {
    if (platform() === "win32") {
      execSync(`where ${command}`, { encoding: "utf-8", stdio: "pipe" });
    } else {
      execSync(`which ${command}`, { encoding: "utf-8", stdio: "pipe" });
    }

    results.push({
      category: "Dependencies",
      status: "✅",
      message: `${label} installed`,
      code: 0,
    });
  } catch (err) {
    results.push({
      category: "Dependencies",
      status: "⚠️",
      message: `${label} not found`,
      suggestion:
        command === "pnpm"
          ? "Install with: npm i -g pnpm"
          : `Install ${label} from official sources`,
      code: 1,
    });
  }
}

function checkEnvironmentVariables(): HealthCheckResult {
  const requiredVars = ["OPENAI_API_KEY"];
  const optionalVars = ["ELEVENLABS_API_KEY", "ANTHROPIC_API_KEY"];

  const missing = requiredVars.filter((v) => !process.env[v]);
  const optionalMissing = optionalVars.filter((v) => !process.env[v]);

  if (missing.length === 0) {
    return {
      category: "Environment",
      status: "✅",
      message: "Required API keys configured",
      code: 0,
    };
  }

  return {
    category: "Environment",
    status: missing.length > 0 ? "❌" : "⚠️",
    message: `Missing: ${missing.join(", ")}${optionalMissing.length > 0 ? ` (optional: ${optionalMissing.join(", ")})` : ""}`,
    suggestion:
      "Set environment variables in .env or export commands. Example: export OPENAI_API_KEY=sk-...",
    code: missing.length > 0 ? 2 : 1,
  };
}

function checkRequiredFiles(projectPath: string): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const requiredFiles = ["tsconfig.json", "vitest.config.ts"];

  for (const file of requiredFiles) {
    const path = join(projectPath, file);
    if (existsSync(path)) {
      results.push({
        category: "Files",
        status: "✅",
        message: `${file} exists`,
        code: 0,
      });
    } else {
      results.push({
        category: "Files",
        status: "⚠️",
        message: `${file} not found`,
        code: 1,
      });
    }
  }

  return results;
}

function checkAPIKeys(): HealthCheckResult {
  const keys: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    keys.push("OpenAI");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    keys.push("Anthropic");
  }
  if (process.env.ELEVENLABS_API_KEY) {
    keys.push("ElevenLabs");
  }

  if (keys.length === 0) {
    return {
      category: "API Keys",
      status: "❌",
      message: "No API keys configured",
      suggestion: "Configure at least one LLM provider",
      code: 2,
    };
  }

  return {
    category: "API Keys",
    status: "✅",
    message: `${keys.length} provider(s) available: ${keys.join(", ")}`,
    code: 0,
  };
}

async function checkVoiceDependencies(): Promise<HealthCheckResult> {
  const osType = platform();

  if (osType === "win32") {
    // Windows has System.Speech built-in
    return {
      category: "Voice",
      status: "✅",
      message: "Windows System.Speech available",
      code: 0,
    };
  } else if (osType === "darwin") {
    // macOS has `say` command
    try {
      execSync("which say", { encoding: "utf-8", stdio: "pipe" });
      return {
        category: "Voice",
        status: "✅",
        message: "macOS `say` command available",
        code: 0,
      };
    } catch {
      return {
        category: "Voice",
        status: "⚠️",
        message: "macOS `say` not found (unexpected)",
        code: 1,
      };
    }
  } else {
    // Linux needs additional tools
    const tools = [];
    try {
      execSync("which espeak", { encoding: "utf-8", stdio: "pipe" });
      tools.push("espeak");
    } catch {}

    try {
      execSync("which arecord", { encoding: "utf-8", stdio: "pipe" });
      tools.push("arecord");
    } catch {}

    if (tools.length > 0) {
      return {
        category: "Voice",
        status: "✅",
        message: `Linux voice tools available: ${tools.join(", ")}`,
        code: 0,
      };
    }

    return {
      category: "Voice",
      status: "⚠️",
      message: "Linux voice tools (espeak, arecord) not found",
      suggestion:
        "Install with: sudo apt-get install espeak alsa-utils (or equivalent for your distro)",
      code: 1,
    };
  }
}

function checkProjectStructure(projectPath: string): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const dirs = ["src", "dist"];

  for (const dir of dirs) {
    const path = join(projectPath, dir);
    if (existsSync(path)) {
      const stat = statSync(path);
      if (stat.isDirectory()) {
        results.push({
          category: "Structure",
          status: "✅",
          message: `${dir}/ directory found`,
          code: 0,
        });
      }
    } else if (dir === "src") {
      results.push({
        category: "Structure",
        status: "❌",
        message: `${dir}/ directory not found`,
        code: 2,
      });
    }
  }

  return results;
}

/**
 * Format health check results for display
 */
export function formatHealthCheck(results: HealthCheckResult[]): string {
  const lines: string[] = [];

  // Group by category
  const byCategory: Record<string, HealthCheckResult[]> = {};
  for (const result of results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);
  }

  // Print header
  lines.push("🏥 Project Health Check");
  lines.push("=".repeat(50));
  lines.push("");

  // Print by category
  for (const [category, categoryResults] of Object.entries(byCategory)) {
    lines.push(`${category}:`);
    for (const result of categoryResults) {
      lines.push(`  ${result.status} ${result.message}`);
      if (result.suggestion) {
        lines.push(`     💡 ${result.suggestion}`);
      }
    }
    lines.push("");
  }

  // Summary
  const errors = results.filter((r) => r.code === 2).length;
  const warnings = results.filter((r) => r.code === 1).length;

  if (errors === 0 && warnings === 0) {
    lines.push("✅ All checks passed!");
  } else {
    if (errors > 0) lines.push(`❌ ${errors} error(s)`);
    if (warnings > 0) lines.push(`⚠️ ${warnings} warning(s)`);
  }

  return lines.join("\n");
}
