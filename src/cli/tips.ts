/**
 * Curated tips for JimCode users.
 * Displayed randomly in the dashboard to help users discover features.
 */
export const tips = [
  "Ask Jim to 'explore' or 'refactor' for deep project insights",
  "Use /mode plan to review proposed steps before Jim executes them",
  "Type /models to browse and switch between different AI engines",
  "Try /compact if the conversation gets too long to refresh context",
  "Use /learn to save project-specific facts to Jim's long-term memory",
  "Review /sessions to jump back into a previous coding conversation",
  "Use /checkpoint to create a recovery point before big refactors",
  "Try /modes to switch between Architect, Ask, and Code roles",
  "Use /plugins to see what specialized tools are currently active",
  "Toggle /stream to switch between real-time and batch responses",
  "Use /rules to see which global instructions are currently active",
  "Hold Ctrl+C for a clean and quick exit from the Jim terminal",
  "Type /config to review your current provider and system settings",
  "Need a quick diagnosis? Try 'help me debug this' in Ask mode",
  "Hold Shift+Enter to input multiple lines in the prompt",
  "Use /terminal-setup to enable advanced terminal features",
  "Jim can read your Git history—ask 'what changed recently?'",
  "Switch to /workmode architect to plan before any code mutation",
  "Type /history to show message counts and context token usage",
  "Jim keeps a mental map of your repository for faster tool use",
  "Each session stores its own tool activity and thought process",
  "Ollama can run in the background with /ollaman for local tasks",
  "Jim's memory is hierarchical from workspace to user-global",
  "Type /themes to pick your favorite CLI color engine",
  "The /models search includes deep keywords and provider filters",
  "Use 'analyze this directory' to get high-level module mapping",
  "Jim supports Mermaid diagrams for architectural visualization",
  "Use /providers to quickly switch between OpenCode and OpenRouter",
  "Check /ollaman if you want Jim specialized in background work",
  "Long conversations? Use /compact to truncate old noise",
  "Search through sessions with keywords in the /sessions menu",
  "The /searchable-picker supports fuzzy-filtering and favorites",
  "Jim can handle Social Media and Web results via native tools",
  "Try /social_doctor to check your internet connection status",
  "Use /office for deep Word, Excel, and PowerPoint automation",
  "Ask 'make a summary of my project' for a high-level README",
  "Jim can run any shell command—use him as your tech co-pilot",
  "Toggle permissions with /mode edit for faster workflows",
  "Type /memory to see what facts Jim has currently 'active'",
  "Jim's thought process is always visible to help you understand him",
  "Use 'help' as a prefix to get guidance directly from Jim",
];

/**
 * Returns a random tip from the curated list.
 */
export const getRandomTip = (): string => {
  return tips[Math.floor(Math.random() * tips.length)];
};
