import type { ToolDefinition, ToolHandler } from "./types.js";

/**
 * Firecrawl API integration for clean Markdown scraping.
 * Uses FIRECRAWL_API_KEY env var.
 * Falls back to simple fetch if no key or error.
 */
async function fetchWithFirecrawl(url: string, maxChars: number, userSignal?: AbortSignal): Promise<{ content: string; source: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timeout);
        controller.abort();
      } else {
        userSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "metadata"],
        onlyMainContent: true,
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Firecrawl HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as {
      data?: {
        markdown?: string;
        metadata?: { title?: string; description?: string };
      };
    };

    if (!data.data?.markdown) {
      throw new Error("No markdown content in Firecrawl response");
    }

    const title = data.data.metadata?.title ? `# ${data.data.metadata.title}\n\n` : "";
    let markdown = title + data.data.markdown;

    if (markdown.length > maxChars) {
      markdown = markdown.slice(0, maxChars) + `\n\n... (${markdown.length - maxChars} chars truncated)`;
    }

    return { content: markdown, source: "firecrawl" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Firecrawl failed for ${url}: ${msg}`);
    return null;
  }
}

/**
 * Jina AI Reader - completely free, no API key needed.
 * Converts any URL to clean Markdown.
 */
async function fetchWithJina(url: string, maxChars: number, userSignal?: AbortSignal): Promise<{ content: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timeout);
        controller.abort();
      } else {
        userSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        "Accept": "text/markdown",
        "User-Agent": "JimAgent/0.4",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Jina HTTP ${res.status}`);
    }

    let markdown = await res.text();

    // Jina returns plain text if it can't parse, check for content
    if (markdown.length < 50 || markdown.includes("Could not extract content")) {
      return null;
    }

    if (markdown.length > maxChars) {
      markdown = markdown.slice(0, maxChars) + `\n\n... (${markdown.length - maxChars} chars truncated)`;
    }

    return { content: markdown, source: "jina-ai (free)" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Jina failed for ${url}: ${msg}`);
    return null;
  }
}

export const web_fetch_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "web_fetch",
    description:
      "Fetch content from a URL and return as clean Markdown. " +
      "Tries multiple AI-powered scrapers (Jina AI first - free, then Firecrawl if API key set), " +
      "falls back to simple HTML stripping. Perfect for docs, GitHub, blogs.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch (must be http:// or https://)",
        },
        max_chars: {
          type: "number",
          description: "Max characters to return (default: 15000)",
        },
      },
      required: ["url"],
    },
  },
};

export const web_fetch_handler: ToolHandler = async (args) => {
  const url = args.url as string;
  const maxChars = (args.max_chars as number) ?? 15000;

  const userSignal = (args as any).__abortSignal as AbortSignal | undefined;

  // Safety: only allow http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { content: "Error: Only http:// and https:// URLs are allowed", isError: true };
  }

  // Try Firecrawl first (premium AI scraping to clean Markdown)
  const firecrawlResult = await fetchWithFirecrawl(url, maxChars, userSignal);
  if (firecrawlResult) {
    return { content: `URL: ${url}\nSource: Firecrawl (AI-powered)\n\n${firecrawlResult.content}` };
  }

  // Try Jina AI (free, no API key needed)
  const jinaResult = await fetchWithJina(url, maxChars, userSignal);
  if (jinaResult) {
    return { content: `URL: ${url}\nSource: Jina AI Reader (free)\n\n${jinaResult.content}` };
  }

  // Fallback: simple fetch with HTML stripping
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timeout);
        controller.abort();
      } else {
        userSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "JimAgent/0.2",
        Accept: "text/html, text/plain, text/markdown, application/json",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };
    }

    const contentType = res.headers.get("content-type") ?? "";
    let text: string;

    if (contentType.includes("json")) {
      const json = await res.json();
      text = JSON.stringify(json, null, 2);
    } else {
      text = await res.text();
    }

    // Strip HTML tags for readability
    if (contentType.includes("html")) {
      text = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const truncated = text.length > maxChars
      ? text.slice(0, maxChars) + `\n... (${text.length - maxChars} chars truncated)`
      : text;

    return { content: `URL: ${url}\nContent-Type: ${contentType}\n\n${truncated}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Fetch error: ${msg}`, isError: true };
  }
};

export const web_search_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo (no API key needed). " +
      "Returns top 5 results with titles, URLs, and snippets. " +
      "Use for finding documentation, solutions, or recent information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        max_results: {
          type: "number",
          description: "Max results (default: 5)",
        },
      },
      required: ["query"],
    },
  },
};

export const web_search_handler: ToolHandler = async (args) => {
  const query = args.query as string;
  const maxResults = (args.max_results as number) ?? 5;

  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    // Use Brave Search API (fast, structured results)
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveKey,
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        return { content: `Brave API error: HTTP ${res.status} - ${errText.slice(0, 200)}`, isError: true };
      }

      const data = await res.json() as {
        web?: { results?: Array<{ title: string; url: string; description?: string }> };
      };

      const results = data.web?.results ?? [];
      if (results.length === 0) {
        return { content: `No results found for: ${query}` };
      }

      const formatted = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description ?? ""}`)
        .join("\n\n");

      return { content: `Search results for "${query}":\n\n${formatted}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Brave search error: ${msg}`, isError: true };
    }
  }

  // Fallback: DuckDuckGo HTML scraping
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "JimAgent/0.2" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { content: `Search failed: HTTP ${res.status}`, isError: true };
    }

    const html = await res.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

    let match: RegExpExecArray | null = resultRegex.exec(html);
    while (match !== null && results.length < maxResults) {
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      let resultUrl = match[1];
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();

      if (resultUrl.includes("uddg=")) {
        const uddgMatch = resultUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) resultUrl = decodeURIComponent(uddgMatch[1]);
      }

      results.push({ title, url: resultUrl, snippet });
      match = resultRegex.exec(html);
    }

    if (results.length === 0) {
      return { content: `No results found for: ${query}` };
    }

    const formatted = results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
      .join("\n\n");

    return { content: `Search results for "${query}":\n\n${formatted}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Search error: ${msg}`, isError: true };
  }
};
