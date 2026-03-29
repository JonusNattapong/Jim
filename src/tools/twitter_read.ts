import { execFileAsync } from "../utils/exec.js";
import type { ToolDefinition, ToolHandler } from "./types.js";

function normalizeTwitterUrl(url: string): string {
  return url.replace("x.com", "twitter.com");
}

function extractTweetId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return m ? m[1] : null;
}

async function findBirdCli(): Promise<string | null> {
  for (const name of ["bird", "birdx"]) {
    try {
      await execFileAsync(name, ["--version"], { timeout: 5000 });
      return name;
    } catch {
      // Try next
    }
  }
  // Try npx path
  try {
    await execFileAsync("npx", ["--yes", "@steipete/bird", "--version"], { timeout: 15000 });
    return "npx --yes @steipete/bird";
  } catch {
    return null;
  }
}

export const twitter_read_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "twitter_read",
    description:
      "Read a Twitter/X tweet or thread using bird CLI. " +
      "Returns tweet text, author, engagement metrics, and thread context. " +
      "Requires bird CLI installed (npm install -g @steipete/bird) and Twitter cookies configured.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Twitter/X tweet URL (e.g. https://x.com/user/status/123456)",
        },
      },
      required: ["url"],
    },
  },
};

export const twitter_read_handler: ToolHandler = async (args) => {
  const url = args.url as string;

  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return { content: `Error: Invalid Twitter/X URL. Expected format: https://x.com/user/status/123456\nGot: ${url}`, isError: true };
  }

  const birdBin = await findBirdCli();
  if (!birdBin) {
    return {
      content: [
        "bird CLI is not installed.",
        "Install: npm install -g @steipete/bird",
        "Then configure cookies:",
        "  1. Log in to Twitter/X in your browser",
        "  2. Use Cookie-Editor extension to export cookies",
        "  3. Set env vars AUTH_TOKEN and CT0, or run: bird configure",
      ].join("\n"),
      isError: true,
    };
  }

  try {
    const normalizedUrl = normalizeTwitterUrl(url);
    const parts = birdBin.split(" ");
    const cmd = parts[0];
    const baseArgs = parts.slice(1);

    const { stdout } = await execFileAsync(
      cmd,
      [...baseArgs, "read", normalizedUrl],
      { timeout: 30000, env: { ...process.env, FORCE_COLOR: "0" } }
    );

    const output = stdout.trim();
    if (!output) {
      return { content: "bird CLI returned empty output. Check your authentication (AUTH_TOKEN and CT0 env vars).", isError: true };
    }

    return { content: output.length > 15000 ? output.slice(0, 15000) + `\n\n... (${output.length - 15000} chars truncated)` : output };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Missing credentials") || msg.includes("auth")) {
      return {
        content: `bird CLI authentication failed. Configure Twitter cookies:\n  1. Log in to Twitter in your browser\n  2. Use Cookie-Editor extension to export cookies\n  3. Set env vars: AUTH_TOKEN and CT0\nError: ${msg}`,
        isError: true,
      };
    }
    return { content: `bird CLI error: ${msg}`, isError: true };
  }
};
