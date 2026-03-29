import { spawn } from "node:child_process";
import type { ToolResult } from "./types.js";

const DANGEROUS_CMDS = [
  /\brm\s+(-[a-z]*f|--force|--recursive)\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  /\bformat\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  />\s*\/dev\//i,
  /\bshutdown\b/i,
  /\breboot\b/i,
];

const BLOCKED_CMDS = [
  /\brm\s+-rf\s+[\/~]\b/i,
  /\brm\s+-rf\s+\/\s*$/i,
  /\b:(){ :|:& };:\b/,
];

/**
 * Execute a command in a Docker sandbox (if available)
 * or fall back to native execution with safety checks.
 */
export async function sandboxedExec(
  command: string,
  opts: { timeout?: number; projectRoot?: string } = {}
): Promise<ToolResult> {
  const timeout = (opts.timeout ?? 30) * 1000;
  const projectRoot = opts.projectRoot ?? process.cwd();

  // Block absolutely destructive commands
  for (const pattern of BLOCKED_CMDS) {
    if (pattern.test(command)) {
      return { content: `🚫 BLOCKED: This command is permanently blocked for safety.`, isError: true };
    }
  }

  // Check if Docker is available
  const hasDocker = await checkDocker();

  if (hasDocker && !isDangerous(command)) {
    return runInDocker(command, projectRoot, timeout);
  }

  // Native execution with danger detection
  return runNative(command, timeout);
}

async function checkDocker(): Promise<boolean> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    await execAsync("docker info", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function isDangerous(command: string): boolean {
  return DANGEROUS_CMDS.some((p) => p.test(command));
}

async function runInDocker(command: string, projectRoot: string, timeout: number): Promise<ToolResult> {
  const dockerArgs = [
    "run",
    "--rm",
    "-v", `${projectRoot}:/workspace`,
    "-w", "/workspace",
    "--network", "host",
    "--memory", "512m",
    "--cpus", "1",
    "--pids-limit", "100",
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "node:22-slim",
    "sh", "-c", command,
  ];

  return spawnProcess("docker", dockerArgs, timeout);
}

async function runNative(command: string, timeout: number): Promise<ToolResult> {
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd" : "sh";
  const args = isWindows ? ["/c", command] : ["-c", command];
  return spawnProcess(shell, args, timeout);
}

function spawnProcess(cmd: string, args: string[], timeout: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let done = false;

    const child = spawn(cmd, args, {
      timeout,
      env: { ...process.env, FORCE_COLOR: "0", NODE_NO_WARNINGS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const killTimer = setTimeout(() => {
      if (!done) { child.kill("SIGTERM"); done = true; }
    }, timeout);

    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);

      const output = [stdout, stderr].filter(Boolean).join("\n");
      const truncated = output.length > 5000
        ? output.slice(0, 5000) + `\n... (${output.length - 5000} truncated)`
        : output || "(no output)";

      if (code === 0) {
        resolve({ content: truncated });
      } else if (code === null) {
        resolve({ content: `Command timed out after ${timeout / 1000}s\n${truncated}`, isError: true });
      } else {
        resolve({ content: truncated || `Command failed with exit code ${code}`, isError: true });
      }
    });

    child.on("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(killTimer);
      resolve({ content: `Process error: ${err.message}`, isError: true });
    });
  });
}
