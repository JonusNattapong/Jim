import type { ToolDefinition, ToolHandler } from "./types.js";
import { getArchivalMemoryStore } from "../context/memory-store.js";

// ─── memory_archive ─────────────────────────────────────────────────────────

export const memory_archive_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_archive",
    description:
      "Archive important information, decisions, solutions, or conversation context " +
      "into persistent long-term memory. Use this to store facts you want to remember " +
      "across sessions — architectural decisions, API patterns, debugging insights, " +
      "user preferences, or resolved issues. This is your long-term brain. " +
      "Prefer archiving structured, searchable content over raw conversation dumps.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The information to archive. Be specific and include key terms for future searchability.",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags for categorization (e.g. 'architecture,api,decisions'). Optional.",
        },
        source: {
          type: "string",
          description: "Where this knowledge came from (e.g. 'conversation', 'code-analysis', 'user-instruction'). Optional.",
        },
      },
      required: ["content"],
    },
  },
};

export const memory_archive_handler: ToolHandler = async (args) => {
  try {
    const content = args.content as string;
    if (!content || content.trim().length === 0) {
      return { content: "Error: content is required and cannot be empty", isError: true };
    }

    const tags = typeof args.tags === "string"
      ? args.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    const store = getArchivalMemoryStore();
    const entry = await store.archive(content, {
      tags,
      source: (args.source as string) ?? "manual",
    });

    return {
      content: `Archived memory entry ${entry.id} (${entry.metadata.tokenCount} tokens, tags: ${tags.join(", ") || "none"})`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error archiving memory: ${msg}`, isError: true };
  }
};

// ─── memory_recall ──────────────────────────────────────────────────────────

export const memory_recall_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_recall",
    description:
      "Search your persistent memory for relevant information. Use this when the user " +
      "references something from a previous session, or when you need to recall a past " +
      "decision, solution, or piece of context. Returns the most relevant archived entries " +
      "ranked by keyword match.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query — keywords or description of what you're looking for.",
        },
        limit: {
          type: "number",
          description: "Max number of results to return (default: 5, max: 20).",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags to filter by (optional).",
        },
      },
      required: ["query"],
    },
  },
};

export const memory_recall_handler: ToolHandler = async (args) => {
  try {
    const query = args.query as string;
    if (!query || query.trim().length === 0) {
      return { content: "Error: query is required", isError: true };
    }

    const limit = Math.min(Math.max((args.limit as number) ?? 5, 1), 20);
    const tags = typeof args.tags === "string"
      ? args.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : undefined;

    const store = getArchivalMemoryStore();
    const results = await store.search(query, limit, tags);

    if (results.length === 0) {
      const count = await store.count();
      return {
        content: `No memories found matching "${query}". (${count} total entries in memory store)`,
      };
    }

    const output: string[] = [
      `Found ${results.length} relevant memories for "${query}":\n`,
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ts = r.entry.timestamp.split("T")[0];
      const tagsStr = r.entry.tags.length > 0 ? ` [${r.entry.tags.join(", ")}]` : "";
      output.push(
        `--- Result ${i + 1} (score: ${r.score.toFixed(1)}, ${ts}${tagsStr}) ---`,
        r.entry.content.slice(0, 1000),
        r.entry.content.length > 1000 ? "... (truncated)" : "",
        "",
      );
    }

    return { content: output.join("\n") };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error recalling memory: ${msg}`, isError: true };
  }
};

// ─── memory_list ────────────────────────────────────────────────────────────

export const memory_list_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_list",
    description:
      "List recent memory entries or get memory store statistics. " +
      "Useful for understanding what's been archived.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of entries to list (default: 20)",
        },
        stats: {
          type: "boolean",
          description: "Show memory statistics instead of listing entries (default: false)",
        },
      },
      required: [],
    },
  },
};

export const memory_list_handler: ToolHandler = async (args) => {
  try {
    const store = getArchivalMemoryStore();

    if (args.stats === true) {
      const s = await store.stats();
      const count = await store.count();
      return {
        content: [
          `Memory Store Statistics:`,
          `  Total entries: ${count}`,
          `  Tags: ${s.totalTags.join(", ") || "none"}`,
        ].join("\n"),
      };
    }

    const limit = Math.min(Math.max((args.limit as number) ?? 20, 1), 100);
    const entries = await store.list(limit);

    if (entries.length === 0) {
      return { content: "Memory store is empty. Use memory_archive to start storing knowledge." };
    }

    const output: string[] = [`Memory Store (${entries.length} entries shown):\n`];
    for (const entry of entries) {
      const ts = entry.timestamp.split("T")[0];
      const tagsStr = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
      output.push(`  ${entry.id} (${ts}${tagsStr}): ${entry.preview.slice(0, 100)}...`);
    }

    return { content: output.join("\n") };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error listing memory: ${msg}`, isError: true };
  }
};

// ─── memory_forget ──────────────────────────────────────────────────────────

export const memory_forget_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_forget",
    description:
      "Delete a specific memory entry by ID. Use memory_list to find entry IDs first. " +
      "Only use this to remove outdated or incorrect archived information.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The memory entry ID to delete",
        },
        clearAll: {
          type: "boolean",
          description: "Clear ALL memories (use with extreme caution, default: false)",
        },
      },
      required: [],
    },
  },
};

export const memory_forget_handler: ToolHandler = async (args) => {
  try {
    const store = getArchivalMemoryStore();

    if (args.clearAll === true) {
      const count = await store.clear();
      return { content: `Cleared all ${count} memory entries.` };
    }

    const id = args.id as string;
    if (!id) {
      return { content: "Error: provide an 'id' or set 'clearAll: true'", isError: true };
    }

    const deleted = await store.deleteEntry(id);
    if (deleted) {
      return { content: `Deleted memory entry ${id}` };
    } else {
      return { content: `Memory entry ${id} not found`, isError: true };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error deleting memory: ${msg}`, isError: true };
  }
};
