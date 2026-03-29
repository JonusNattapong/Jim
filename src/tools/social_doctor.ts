import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolHandler } from "./types.js";

const execFileAsync = promisify(execFile);

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "off";
  message: string;
}

async function checkCommand(cmd: string, args: string[], label: string): Promise<CheckResult> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 10000 });
    return { name: label, status: "ok", message: `${cmd} available (${stdout.trim().split("\n")[0]})` };
  } catch {
    return { name: label, status: "off", message: `${cmd} not found` };
  }
}

async function checkReddit(): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://www.reddit.com/r/linux.json?limit=1", {
      signal: controller.signal,
      headers: { "User-Agent": "JimAgent/0.4" },
    });
    clearTimeout(timer);
    if (res.ok) {
      return { name: "Reddit", status: "ok", message: "JSON API accessible (direct connection works)" };
    }
    return { name: "Reddit", status: "warn", message: `HTTP ${res.status} — may need proxy from server IP` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "Reddit", status: "warn", message: `Connection failed: ${msg}. Server IP may be blocked, try proxy.` };
  }
}

async function checkBird(): Promise<CheckResult> {
  for (const name of ["bird", "birdx"]) {
    try {
      await execFileAsync(name, ["--version"], { timeout: 5000 });
      // Check auth
      try {
        const { stdout } = await execFileAsync(name, ["check"], { timeout: 10000 });
        if (stdout.includes("authenticated") || stdout.includes("ready")) {
          return { name: "Twitter/X (bird)", status: "ok", message: `${name} installed and authenticated` };
        }
      } catch {
        // auth check may not be supported
      }
      return { name: "Twitter/X (bird)", status: "ok", message: `${name} installed (check AUTH_TOKEN/CT0 env vars if read fails)` };
    } catch {
      // continue
    }
  }
  return { name: "Twitter/X (bird)", status: "off", message: "bird CLI not installed. Install: npm install -g @steipete/bird" };
}

async function checkJina(): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://r.jina.ai/https://example.com", {
      signal: controller.signal,
      headers: { "Accept": "text/markdown" },
    });
    clearTimeout(timer);
    if (res.ok) {
      return { name: "Web (Jina Reader)", status: "ok", message: "Jina Reader accessible (free, no API key)" };
    }
    return { name: "Web (Jina Reader)", status: "warn", message: `Jina HTTP ${res.status}` };
  } catch {
    return { name: "Web (Jina Reader)", status: "warn", message: "Jina Reader unreachable. web_fetch will use fallback." };
  }
}

export const social_doctor_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "social_doctor",
    description:
      "Diagnose which social media and internet tools are available. " +
      "Checks yt-dlp (YouTube), bird (Twitter/X), Reddit API, Jina Reader, gh CLI, and search providers. " +
      "Use this to understand what internet capabilities are installed before asking for social media tasks.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const social_doctor_handler: ToolHandler = async () => {
  const checks = await Promise.all([
    checkJina(),
    checkCommand("yt-dlp", ["--version"], "YouTube (yt-dlp)"),
    checkBird(),
    checkReddit(),
    checkCommand("gh", ["--version"], "GitHub (gh CLI)"),
    checkCommand("node", ["--version"], "Node.js (JS runtime)"),
  ]);

  // Check search
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  let searchCheck: CheckResult;
  if (braveKey) {
    searchCheck = { name: "Web Search", status: "ok", message: "Brave Search API configured" };
  } else {
    searchCheck = { name: "Web Search", status: "ok", message: "DuckDuckGo (free, no API key)" };
  }
  checks.push(searchCheck);

  const okCount = checks.filter((c) => c.status === "ok").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const offCount = checks.filter((c) => c.status === "off").length;

  let output = `Social Doctor — ${okCount} ok, ${warnCount} warn, ${offCount} off\n\n`;

  for (const c of checks) {
    const icon = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
    output += `${icon} ${c.name}: ${c.message}\n`;
  }

  if (offCount > 0 || warnCount > 0) {
    output += "\nSetup instructions:\n";
    for (const c of checks) {
      if (c.status === "off") {
        if (c.name.includes("yt-dlp")) output += "  pip install yt-dlp\n";
        if (c.name.includes("bird")) output += "  npm install -g @steipete/bird\n";
        if (c.name.includes("gh")) output += "  https://cli.github.com\n";
      }
    }
  }

  return { content: output };
};
