const TOOL_LABELS: Record<string, { label: string; icon: string; verb: string }> = {
  // File operations
  read_file:      { label: "Reading file",        icon: "📖", verb: "read" },
  write_file:     { label: "Creating file",        icon: "＋", verb: "write" },
  edit_file:      { label: "Editing file",         icon: "✎",  verb: "edit" },
  list_files:     { label: "Listing files",        icon: "📂", verb: "list" },
  delete_file:    { label: "Deleting file",        icon: "🗑",  verb: "delete" },

  // Code & search
  grep:           { label: "Searching code",       icon: "⌕",  verb: "search" },
  get_repo_map:   { label: "Mapping repository",   icon: "◫",  verb: "map" },
  graph_query:    { label: "Querying code graph",  icon: "◇",  verb: "query" },
  ts_check:       { label: "Type checking",        icon: "✓",  verb: "check" },

  // Shell & git
  run_command:    { label: "Bash",             icon: "●",  verb: "execute" },
  powershell:     { label: "PowerShell",       icon: "●",  verb: "execute" },
  git_command:    { label: "Git",              icon: "●",  verb: "execute git" },
  get_project_info: { label: "Reading project info", icon: "ℹ", verb: "inspect" },

  // Planning & agent
  todo_write:     { label: "Planning tasks",       icon: "☐",  verb: "plan" },
  ask_user_choice: { label: "Asking you",         icon: "?",  verb: "ask" },
  spawn_agent:    { label: "Spawning sub-agent",   icon: "◎",  verb: "spawn" },
  reflect:        { label: "Reflecting",           icon: "◈",  verb: "reflect" },
  apply_diff:     { label: "Applying changes",     icon: "✎",  verb: "apply" },

  // Web & social
  web_fetch:      { label: "Fetching page",        icon: "↗",  verb: "fetch" },
  web_search:     { label: "Searching web",        icon: "⌕",  verb: "search" },
  browser_action: { label: "Controlling browser",  icon: "▣",  verb: "browse" },

  // Social tools
  youtube_transcript: { label: "Reading YouTube",  icon: "▶",  verb: "read" },
  twitter_read:   { label: "Reading Twitter",      icon: "𝕏",  verb: "read" },
  reddit_read:    { label: "Reading Reddit",       icon: "⊡",  verb: "read" },
  social_doctor:  { label: "Checking social tools", icon: "✓", verb: "diagnose" },

  // Office
  office:         { label: "Working with Office",  icon: "▤",  verb: "edit" },
  office_doctor:  { label: "Checking OfficeCLI",   icon: "✓",  verb: "diagnose" },

  // Memory
  memory_archive: { label: "Archiving memory",     icon: "⊡",  verb: "archive" },
  memory_recall:  { label: "Recalling memory",     icon: "⊡",  verb: "recall" },
  memory_list:    { label: "Listing memories",      icon: "⊡",  verb: "list" },
  memory_forget:  { label: "Forgetting memory",    icon: "⊡",  verb: "forget" },

  // MCP & plugins
  mcp_manager:    { label: "Managing MCP servers",  icon: "⚙",  verb: "configure" },
  list_plugins:   { label: "Listing plugins",       icon: "⊡",  verb: "list" },
};

const DEFAULT_LABEL = { label: "Executing tool", icon: "▸", verb: "execute" };

/** Get human-readable label for a tool name (e.g. "Planning tasks" for todo_write) */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name]?.label ?? `${DEFAULT_LABEL.label} ${name}`;
}

/** Get icon for a tool name */
export function toolIcon(name: string): string {
  return TOOL_LABELS[name]?.icon ?? DEFAULT_LABEL.icon;
}

/** Get verb for a tool name (e.g. "edit" for edit_file) */
export function toolVerb(name: string): string {
  return TOOL_LABELS[name]?.verb ?? DEFAULT_LABEL.verb;
}
