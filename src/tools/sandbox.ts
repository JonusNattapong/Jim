import { spawn, ChildProcess } from "node:child_process";
import type { ToolResult } from "./types.js";

// Pillar 6: Track running processes for interactive input
export const activeProcesses = new Map<string, ChildProcess>();

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
  opts: { timeout?: number; projectRoot?: string; __abortSignal?: AbortSignal } = {}
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
    return runInDocker(command, projectRoot, timeout, opts.__abortSignal);
  }

  // Native execution with danger detection
  return runNative(command, timeout, opts.__abortSignal);
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

async function runInDocker(command: string, projectRoot: string, timeout: number, abortSignal?: AbortSignal): Promise<ToolResult> {
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

  return spawnProcess("docker", dockerArgs, timeout, abortSignal);
}

async function runNative(command: string, timeout: number, abortSignal?: AbortSignal): Promise<ToolResult> {
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd" : "sh";
  const args = isWindows ? ["/c", command] : ["-c", command];
  return spawnProcess(shell, args, timeout, abortSignal);
}

function spawnProcess(cmd: string, args: string[], timeout: number, abortSignal?: AbortSignal): Promise<ToolResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let done = false;
    let aborted = false;
    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const child = spawn(cmd, args, {
      timeout,
      env: { ...process.env, FORCE_COLOR: "0", NODE_NO_WARNINGS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    activeProcesses.set(processId, child);

    const onAbort = () => {
      if (!done) {
        aborted = true;
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      }
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        aborted = true;
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      } else {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }
    }

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const killTimer = setTimeout(() => {
      if (!done) { try { child.kill("SIGTERM"); } catch { /* ignore */ } done = true; }
    }, timeout);

    const cleanup = () => {
      clearTimeout(killTimer);
      if (abortSignal) {
        try { abortSignal.removeEventListener("abort", onAbort); } catch { /* ignore */ }
      }
    };

    child.on("close", (code) => {
      if (done) return;
      done = true;
      cleanup();
      activeProcesses.delete(processId);

      const output = [stdout, stderr].filter(Boolean).join("\n");
      const truncated = output.length > 5000
        ? output.slice(0, 5000) + `\n... (${output.length - 5000} truncated)`
        : output || "(no output)";

      if (aborted) {
        resolve({ content: `Aborted`, isError: true });
        return;
      }

      if (code === 0) {
        resolve({ content: truncated, metadata: { processId } });
      } else if (code === null) {
        resolve({ content: `Command timed out after ${timeout / 1000}s\n${truncated}`, isError: true, metadata: { processId } });
      } else {
        resolve({ content: truncated || `Command failed with exit code ${code}`, isError: true, metadata: { processId } });
      }
    });

    child.on("error", (err) => {
      if (done) return;
      done = true;
      cleanup();
      activeProcesses.delete(processId);
      resolve({ content: `Process error: ${err.message}`, isError: true });
    });
  });
}
