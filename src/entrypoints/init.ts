/**
 * Bootstrap initialization for Jim
 * Handles graceful startup, configuration loading, and system checks
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { childLogger } from "../utils/logger.js";
import type { PlanManager } from "../agent/plan-manager.js";

export interface InitConfig {
  projectRoot: string;
  verbose?: boolean;
  skipChecks?: boolean;
}

export interface InitResult {
  success: boolean;
  error?: string;
  jimDir: string;
  sessionsDir: string;
  plansDir: string;
  memoryDir: string;
  skillsDir: string;
  pluginsDir: string;
  configPath: string;
  themesPath: string;
  healthStatus: HealthStatus;
}

export interface HealthStatus {
  nodeVersion: string;
  npmVersion: string;
  hasApiKey: boolean;
  hasModel: boolean;
  diskSpace: string;
  timestamp: number;
}

export interface BootstrapOptions {
  forceInit?: boolean;
  migrateConfig?: boolean;
  runHealthCheck?: boolean;
  installDependencies?: boolean;
}

const log = childLogger({ component: "init" });

/**
 * Initialize Jim environment
 */
export async function initializeJim(config: InitConfig): Promise<InitResult> {
  const startTime = Date.now();
  log.info("Starting initialization...");

  try {
    const jimDir = join(homedir(), ".jim");
    const sessionsDir = join(jimDir, "sessions");
    const plansDir = join(jimDir, "plans");
    const memoryDir = join(jimDir, "memory");
    const skillsDir = join(jimDir, "skills");
    const pluginsDir = join(jimDir, "plugins");
    const configPath = join(jimDir, "config.json");
    const themesPath = join(jimDir, "themes.json");

    // Create directories
    const dirs = [
      jimDir,
      sessionsDir,
      plansDir,
      memoryDir,
      skillsDir,
      pluginsDir,
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        log.debug(`Created directory: ${dir}`);
      }
    }

    // Verify Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);
    if (majorVersion < 20) {
      const healthStatus = await runHealthCheck();
      return {
        success: false,
        error: `Jim requires Node.js 20+. Current version: ${nodeVersion}`,
        jimDir,
        sessionsDir,
        plansDir,
        memoryDir,
        skillsDir,
        pluginsDir,
        configPath,
        healthStatus,
      };
    }

    // Initialize graceful shutdown
    setupGracefulShutdown();

    // Run health check
    const healthStatus = await runHealthCheck();

    // Migrate old config if exists
    await migrateOldConfig(jimDir, configPath);

    // Initial Sample Themes if not exists
    if (!existsSync(themesPath)) {
      const sampleThemes = [
        {
          id: "claude",
          label: "Claude (Minimalist)",
          primary: "#D97706",
          primaryBright: "#F59E0B",
          secondary: "#FAFAFA",
          secondaryDark: "#E5E5E5",
          success: "#059669",
          warning: "#D97706",
          error: "#DC2626",
          info: "#2563EB",
          accent: "#D97706",
          text: "#E5E5E5",
          textBright: "#FFFFFF",
          textMuted: "#737373",
          inverse: "#0A0A0A",
          border: "#262626",
          borderAccent: "#D97706",
          diffAddBg: "#064E3B",
          diffAddFg: "#ECFDF5",
          diffRemBg: "#7F1D1D",
          diffRemFg: "#FEF2F2"
        }
      ];
      writeFileSync(themesPath, JSON.stringify(sampleThemes, null, 2));
      log.info("Created sample themes.json");
    }

    log.info(`Initialization complete in ${Date.now() - startTime}ms`);

    return {
      success: true,
      jimDir,
      sessionsDir,
      plansDir,
      memoryDir,
      skillsDir,
      pluginsDir,
      configPath,
      themesPath,
      healthStatus,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Initialization failed: ${msg}`);
    const fallbackHealth: HealthStatus = {
      nodeVersion: process.version,
      npmVersion: "unknown",
      hasApiKey: false,
      hasModel: false,
      diskSpace: "unknown",
      timestamp: Date.now(),
    };
    return {
      success: false,
      error: msg,
      jimDir: join(homedir(), ".jim"),
      sessionsDir: join(homedir(), ".jim", "sessions"),
      plansDir: join(homedir(), ".jim", "plans"),
      memoryDir: join(homedir(), ".jim", "memory"),
      skillsDir: join(homedir(), ".jim", "skills"),
      pluginsDir: join(homedir(), ".jim", "plugins"),
      configPath: join(homedir(), ".jim", "config.json"),
      themesPath: join(homedir(), ".jim", "themes.json"),
      healthStatus: fallbackHealth,
    };
  }
}

/**
 * Run health check
 */
async function runHealthCheck(): Promise<HealthStatus> {
  const nodeVersion = process.version;

  let npmVersion = "unknown";
  try {
    npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
  } catch {
    // npm not available
  }

  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const hasModel = !!process.env.OPENAI_MODEL;

  let diskSpace = "unknown";
  try {
    const jimDir = join(homedir(), ".jim");
    if (existsSync(jimDir)) {
      const stats = execSync(`du -sh "${jimDir}" 2>/dev/null || echo "N/A"`, {
        encoding: "utf-8",
      }).trim();
      diskSpace = stats.split("\t")[0] || "N/A";
    }
  } catch {
    // disk check failed
  }

  return {
    nodeVersion,
    npmVersion,
    hasApiKey,
    hasModel,
    diskSpace,
    timestamp: Date.now(),
  };
}

/**
 * Migrate old config format to new format
 */
async function migrateOldConfig(
  jimDir: string,
  configPath: string,
): Promise<void> {
  const oldConfigPath = join(jimDir, ".jimrc.json");
  if (existsSync(oldConfigPath) && !existsSync(configPath)) {
    try {
      const oldConfig = JSON.parse(readFileSync(oldConfigPath, "utf-8"));
      writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));
      log.info("Migrated old config to new format");
    } catch {
      log.warn("Failed to migrate old config");
    }
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    log.info(`Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Uncaught exception: ${msg}`);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    log.error(`Unhandled rejection: ${msg}`);
  });
}

/**
 * Fast-path checks for CLI entry
 */
export function fastPathChecks(args: string[]): {
  shouldExit: boolean;
  exitCode: number;
  message?: string;
} {
  // Version check
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    const { version } = require("../../package.json");
    return { shouldExit: true, exitCode: 0, message: version };
  }

  // Help check
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return {
      shouldExit: true,
      exitCode: 0,
      message: getHelpText(),
    };
  }

  return { shouldExit: false, exitCode: 0 };
}

function getHelpText(): string {
  return `
Jim - AI Coding Agent

Usage: jim [options]

Options:
  -v, --version     Show version
  -h, --help        Show this help
  -s, --session     Load session ID
  --smoke-exit      Smoke test (exit immediately)

Environment Variables:
  OPENAI_API_KEY    OpenAI API key (required)
  OPENAI_MODEL      Model to use (default: gpt-4o)
  MAX_TURNS         Maximum turns per session (default: 25)
  PERMISSION_MODE   Permission mode: ask/default/acceptEdits/dontAsk
  LOG_LEVEL         Log level: debug/info/warn/error

Commands:
  Type /help in the TUI for available slash commands.
`;
}

/**
 * Parse CLI arguments
 */
export interface ParsedArgs {
  sessionId?: string;
  smokeExit: boolean;
  verbose: boolean;
  remaining: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    smokeExit: false,
    verbose: false,
    remaining: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-s":
      case "--session":
        result.sessionId = args[++i];
        break;
      case "--smoke-exit":
        result.smokeExit = true;
        break;
      case "-v":
      case "--verbose":
        result.verbose = true;
        break;
      default:
        if (arg.startsWith("session-")) {
          result.sessionId = arg;
        } else {
          result.remaining.push(arg);
        }
    }
  }

  return result;
}
