import type { ToolDefinition, ToolHandler } from "./types.js";

const REDDIT_UA = "JimAgent/0.4";
const TIMEOUT_MS = 15000;

function extractRedditInfo(url: string): { type: "post" | "subreddit" | "search"; id?: string; subreddit?: string; query?: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "").replace("old.", "").replace("new.", "");
    if (host !== "reddit.com" && host !== "redd.it") return null;

    // https://redd.it/abc123
    if (host === "redd.it") {
      const id = u.pathname.slice(1);
      return id ? { type: "post", id } : null;
    }

    const parts = u.pathname.split("/").filter(Boolean);

    // /r/subreddit/comments/postid/...
    if (parts[0] === "r" && parts[2] === "comments" && parts[3]) {
      return { type: "post", id: parts[3], subreddit: parts[1] };
    }

    // /r/subreddit
    if (parts[0] === "r" && parts[1]) {
      if (parts[2] === "search" && u.searchParams.get("q")) {
        return { type: "search", subreddit: parts[1], query: u.searchParams.get("q")! };
      }
      return { type: "subreddit", subreddit: parts[1] };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchRedditJson(path: string): Promise<unknown> {
  const url = `https://www.reddit.com${path}.json?raw_json=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": REDDIT_UA,
        "Accept": "application/json",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Reddit HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function formatComment(comment: { data?: { author?: string; body?: string; score?: number; depth?: number } }, indent = 0): string {
  const d = comment.data;
  if (!d?.body) return "";
  const prefix = "  ".repeat(indent);
  const score = d.score != null ? ` (${d.score} pts)` : "";
  let result = `${prefix}**${d.author ?? "?"}**${score}: ${d.body}\n`;
  return result;
}

export const reddit_read_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "reddit_read",
    description:
      "Read Reddit posts, comments, and subreddit content using the Reddit JSON API. " +
      "No authentication or API key required. " +
      "Supports reading individual posts with comments, browsing subreddits, and searching within subreddits.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Reddit URL (post, subreddit, or search). E.g. https://reddit.com/r/programming/comments/abc123",
        },
        sort: {
          type: "string",
          description: "Sort order for comments/posts: best, top, new, hot, rising (default: best)",
        },
        max_comments: {
          type: "number",
          description: "Max comments to return for a post (default: 20)",
        },
        max_chars: {
          type: "number",
          description: "Max total characters to return (default: 15000)",
        },
      },
      required: ["url"],
    },
  },
};

export const reddit_read_handler: ToolHandler = async (args) => {
  const url = args.url as string;
  const sort = (args.sort as string) ?? "best";
  const maxComments = (args.max_comments as number) ?? 20;
  const maxChars = (args.max_chars as number) ?? 15000;

  const info = extractRedditInfo(url);
  if (!info) {
    return { content: `Error: Could not parse Reddit URL: ${url}\nExpected format: https://reddit.com/r/subreddit/comments/postid/...`, isError: true };
  }

  try {
    if (info.type === "post") {
      const data = await fetchRedditJson(`/r/${info.subreddit ?? "all"}/comments/${info.id}`) as [unknown, unknown];
      const listing = data[0] as { data?: { children?: Array<{ data?: { title?: string; selftext?: string; author?: string; score?: number; subreddit?: string; num_comments?: number; url?: string; created_utc?: number } }> } };
      const commentsListing = data[1] as { data?: { children?: Array<{ kind?: string; data?: { author?: string; body?: string; score?: number; depth?: number; replies?: unknown } }> } };

      const post = listing.data?.children?.[0]?.data;
      if (!post) {
        return { content: "Post not found or may have been deleted.", isError: true };
      }

      let output = `Title: ${post.title}\n`;
      output += `Subreddit: r/${post.subreddit}\n`;
      output += `Author: u/${post.author}\n`;
      output += `Score: ${post.score} | Comments: ${post.num_comments}\n`;
      if (post.selftext) {
        output += `\nPost content:\n${post.selftext}\n`;
      }
      if (post.url && !post.url.includes("reddit.com")) {
        output += `\nLink: ${post.url}\n`;
      }

      // Comments
      const comments = commentsListing.data?.children ?? [];
      const actualComments = comments.filter((c) => c.kind === "t1" && c.data?.body);
      if (actualComments.length > 0) {
        output += `\nTop comments:\n`;
        for (const c of actualComments.slice(0, maxComments)) {
          output += formatComment(c as { data?: { author?: string; body?: string; score?: number; depth?: number } }, 0);
        }
      }

      return { content: output.length > maxChars ? output.slice(0, maxChars) + `\n\n... (${output.length - maxChars} chars truncated)` : output };
    }

    if (info.type === "subreddit") {
      const path = sort === "hot" || sort === "rising"
        ? `/r/${info.subreddit}/${sort}`
        : `/r/${info.subreddit}/${sort}?t=day`;

      const data = await fetchRedditJson(path) as { data?: { children?: Array<{ data?: { title?: string; score?: number; num_comments?: number; author?: string; permalink?: string; selftext?: string } }> } };
      const posts = data.data?.children ?? [];

      let output = `r/${info.subreddit} — ${sort}\n\n`;
      for (const p of posts.slice(0, 25)) {
        const d = p.data;
        if (!d) continue;
        output += `[${d.score} pts | ${d.num_comments} comments] ${d.title}\n`;
        output += `  u/${d.author} — https://reddit.com${d.permalink}\n`;
        if (d.selftext) {
          output += `  ${d.selftext.slice(0, 200)}${d.selftext.length > 200 ? "..." : ""}\n`;
        }
        output += "\n";
      }

      return { content: output.length > maxChars ? output.slice(0, maxChars) + `\n\n... (${output.length - maxChars} chars truncated)` : output };
    }

    if (info.type === "search") {
      const data = await fetchRedditJson(`/r/${info.subreddit}/search?q=${encodeURIComponent(info.query!)}&restrict_sr=1&sort=relevance&t=all`) as { data?: { children?: Array<{ data?: { title?: string; score?: number; num_comments?: number; author?: string; permalink?: string; selftext?: string } }> } };
      const posts = data.data?.children ?? [];

      let output = `Search in r/${info.subreddit}: "${info.query}"\n\n`;
      for (const p of posts.slice(0, 10)) {
        const d = p.data;
        if (!d) continue;
        output += `[${d.score} pts | ${d.num_comments} comments] ${d.title}\n`;
        output += `  https://reddit.com${d.permalink}\n`;
        if (d.selftext) {
          output += `  ${d.selftext.slice(0, 200)}\n`;
        }
        output += "\n";
      }

      return { content: output.length > maxChars ? output.slice(0, maxChars) + `\n\n... (${output.length - maxChars} chars truncated)` : output };
    }

    return { content: "Unsupported Reddit URL type", isError: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("403") || msg.includes("blocked")) {
      return {
        content: `Reddit blocked the request (HTTP 403). This typically happens on server IPs. Solutions:\n  1. Use from a local machine instead\n  2. Configure a proxy: set REDDIT_PROXY env var\n  3. Use web_search to find Reddit content via search engines\nError: ${msg}`,
        isError: true,
      };
    }
    return { content: `Reddit error: ${msg}`, isError: true };
  }
};
