import type { ToolDefinition, ToolHandler } from "./types.js";

export const list_plugins_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "list_plugins",
    description:
      "List built-in capabilities and connected MCP plugins/extensions. " +
      "Use when the user asks what integrations or plugins are available.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const list_plugins_handler: ToolHandler = async () => ({
  content:
    "Built-in tools:\n" +
    "- file ops: read_file, edit_file, write_file, list_files\n" +
    "- search: grep\n" +
    "- execution: run_command, git_command\n" +
    "- project: get_project_info, get_repo_map\n" +
    "- tasks: todo_write, ask_user_choice\n" +
    "- web: web_fetch, web_search\n" +
    "- reasoning: reflect\n" +
    "- code intelligence: graph_query (build/query/trace/impact/deps/cycles)\n" +
    "- agents: spawn_agent (roles: explore, general, planner, executor, reviewer, web_surfer)\n" +
    "- browser: browser_action (auto-loads Puppeteer MCP for navigate, click, type, screenshot, etc.)\n" +
    "- mcp: mcp_manager (dynamically load/unload MCP servers on-the-fly)\n" +
    "- memory: memory_archive, memory_recall, memory_list, memory_forget\n\n" +
    "MCP presets: postgres, sqlite, filesystem, fetch, memory, git, sequentialthinking, time,\n" +
    "  redis, puppeteer, brave_search, github, slack, google_drive, google_maps, sentry\n\n" +
    "Custom MCP servers can also be loaded via mcp_manager with command/args.\n\n" +
    "GraphRAG features:\n" +
    "- graph_query build: Index codebase into knowledge graph (AST-based)\n" +
    "- graph_query query: Search entities by name/type\n" +
    "- graph_query trace: Find relationship path between two entities\n" +
    "- graph_query impact: Blast radius analysis (what breaks if X changes)\n" +
    "- graph_query deps: Show dependencies of a file or entity\n" +
    "- graph_query cycles: Find circular dependencies\n" +
    "- graph_query related: Find all connected entities\n" +
    "- graph_query bughunt: Surface hotspots, risky cycles, and likely bug zones",
});
