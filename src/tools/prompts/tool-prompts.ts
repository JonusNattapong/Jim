/**
 * Tool-Specific Prompt Templates
 * Each tool gets system prompt instructions about how to use it effectively
 */

export interface ToolPrompt {
  name: string;
  description: string;
  systemPrompt: string;
  tips: string[];
  commonMistakes: string[];
}

export const TOOL_PROMPTS = {
  run_command: {
    name: "run_command",
    description: "Execute shell commands",
    systemPrompt: `You have access to run_command to execute shell commands. Understanding exit codes is critical:
- Exit code 0 = success
- Exit code 1 = command-specific meaning (grep: no match, find: partial success)
- Exit code 2+ = actual error

ALWAYS check the command type to interpret exit code correctly before reporting an error.
For repetitive operations (renaming 50+ files), create a script and execute it rather than looping tool calls.
Use timeout parameter for long-running commands (default 30s).
Output is truncated to 5000 chars — use grep for targeted searches instead of reading large outputs.`,
    tips: [
      "Use 'which <command>' to check if a tool is installed",
      "Batch file operations into a script instead of looping",
      "Always use '2>&1' to capture both stdout and stderr",
      "Set timeout for network operations: run_command with timeout=60",
      "Use && for command chaining when later commands depend on earlier success",
    ],
    commonMistakes: [
      "Treating exit code 1 from grep/rg as an error (it's just 'no match')",
      "Trying to loop tool calls 50+ times instead of writing a script",
      "Not passing --timeout for curl/wget operations",
      "Forgetting to cd into the right directory before running git commands",
    ],
  } as ToolPrompt,

  grep: {
    name: "grep",
    description: "Fast text search using ripgrep",
    systemPrompt: `Use grep (ripgrep) for TARGETED searches before reading entire files. This is your primary discovery tool.
- Fast regex search: grep pattern='export.*function' path='src'
- Context lines: grep pattern='MyClass' context_lines=5
- Max results: limit to 50 by default, increase only if needed
- Exit code 1 = no match (not an error), 2+ = real error

Ripgrep automatically excludes node_modules, .git, dist, build.
Use glob filters for specific file types: glob='*.ts' for TypeScript only.`,
    tips: [
      "Always grep BEFORE reading files to find exact locations",
      "Use case_insensitive=true for less precise searches",
      "Increase context_lines when searching for function bodies (5-10 lines good)",
      "Use pattern='definition|declaration' for multiple search terms (regex 'or')",
      "Search paths can be directories or specific files",
    ],
    commonMistakes: [
      "Not using grep first, then reading 50 files manually",
      "Treating 'no matches' as an error instead of adjusting the pattern",
      "Not using glob filters, getting results from node_modules",
      "Using simple text patterns when regex would be more powerful",
    ],
  } as ToolPrompt,

  read_file: {
    name: "read_file",
    description: "Read file contents",
    systemPrompt: `Use read_file after grep to view specific file sections. Always use line ranges [startLine, endLine] to read only what you need.
- Output is truncated to ~5000 chars
- Use grep FIRST to find line numbers
- Read in context: if line 50 interests you, read [45, 55] to see surrounding code
- For large files, first grep to find the relevant section, then read that range`,
    tips: [
      "Use line numbers to read specific sections, not entire files",
      "When reading a function, include 3-5 lines before/after the range",
      "For JSON/config files, grep for the key first to find its location",
      "If truncated message appears, adjust startLine/endLine to smaller ranges",
    ],
    commonMistakes: [
      "Reading entire large files (gets truncated at 5000 chars)",
      "Not using grep first to find line numbers",
      "Reading from line 1 to 999 when you only need lines 45-55",
    ],
  } as ToolPrompt,

  edit_file: {
    name: "edit_file",
    description: "Modify file contents",
    systemPrompt: `Use edit_file to make precise modifications. Always include 3-5 lines of context BEFORE and AFTER the change.
- Include exact surrounding code so the system can identify the right location
- For multiple edits in same file, use sequential calls or batch via script
- First grep to find the exact lines you want to change
- Verify the change by reading the file after edit_file completes
- If edit fails, grep again to double-check the exact text`,
    tips: [
      "Always provide exact context - 3-5 lines before and after your change",
      "For large replacements, create a new file and run_command to replace",
      "Test changes by reading the file after editing",
      "Use grep to find exact line numbers before attempting edit",
      "If multiple edits needed, consider grouping them into a script",
    ],
    commonMistakes: [
      "Not including enough context, causing 'string not found' errors",
      "Trying to replace code with slightly different formatting",
      "Not verifying the edit actually happened",
      "Editing a function that exists in multiple places without narrowing scope",
    ],
  } as ToolPrompt,

  git_command: {
    name: "git_command",
    description: "Git version control operations",
    systemPrompt: `Git operations require understanding branch state and merge conflicts.
- Always check status first: git_command 'status'
- For commits: add files, then commit
- Merge conflicts need manual resolution before continuing
- Exit code 0 = success, 1+ = error/conflict
- Use '--no-edit' flag for automatic commit messages`,
    tips: [
      "Check git status before making changes",
      "Use --no-pager for cleaner output",
      "For new branches: git_command 'checkout -b new-feature'",
      "Stash changes: git_command 'stash' before switching branches",
      "Use --force-with-lease instead of --force for safety",
    ],
    commonMistakes: [
      "Assuming current branch state without checking status",
      "Not handling merge conflicts properly",
      "Using --force (lose work), should use --force-with-lease",
      "Committing to wrong branch without checking",
    ],
  } as ToolPrompt,

  web_fetch: {
    name: "web_fetch",
    description: "Fetch web content",
    systemPrompt: `Use web_fetch to retrieve content from URLs. Respects robots.txt and user-agent limits.
- Set timeout for slow websites (seconds parameter)
- Truncates to 8000 chars by default
- Use markdown conversion for article extraction
- Some sites require specific User-Agent headers`,
    tips: [
      "For large pages, use markdown=true for cleaner extraction",
      "Set timeout=30 for slow or unreliable sites",
      "Check for rate limiting in response headers",
      "Use curl via run_command for complex HTTP requests",
    ],
    commonMistakes: [
      "Not setting timeout for slow websites",
      "Assuming all pages are accessible (some require auth)",
      "Not checking rate limiting before bulk fetches",
    ],
  } as ToolPrompt,

  write_file: {
    name: "write_file",
    description: "Create new files",
    systemPrompt: `Use write_file to create new files with initial content. Overwrites existing files.
- Use for generated code, templates, and new modules
- For small files prefer direct content, for large use scripts
- Always verify the file was created correctly by reading it back`,
    tips: [
      "Use for scaffolding new files and templates",
      "Include file headers/comments for clarity",
      "For complex generation, write a script instead of hardcoding",
      "Verify with read_file after creation",
    ],
    commonMistakes: [
      "Not checking if file already exists before writing",
      "Generated files with syntax errors (test them)",
    ],
  } as ToolPrompt,

  reflect: {
    name: "reflect",
    description: "Self-critique and analysis",
    systemPrompt: `Call reflect when stuck or after repeated failures. This triggers forced self-analysis.
- Use after 2+ identical errors indicate a wrong approach
- Reflect provides root-cause analysis
- MUST follow the reflection diagnosis with a different approach
- Never repeat the same failed action after reflection`,
    tips: [
      "Use reflect after identical errors repeat 2+ times",
      "Follow its diagnosis with a genuinely different approach",
      "Reflect can suggest alternative tools or strategies",
    ],
    commonMistakes: [
      "Calling reflect but then trying the same thing again",
      "Not using reflect when stuck in error loops",
    ],
  } as ToolPrompt,

  task_manage: {
    name: "task_manage",
    description: "Project task tracking",
    systemPrompt: `Use task_manage to track milestones and complex multi-step work.
- Create tasks for major features or fixes
- Update progress as you work
- Helps organize long-running projects
- Use with todo_write for detailed step tracking`,
    tips: [
      "Create tasks for major features, not every small thing",
      "Update status as you progress",
      "Link related tasks together",
    ],
    commonMistakes: ["Over-tracking trivial steps", "Not updating task status as you work"],
  } as ToolPrompt,

  ts_check: {
    name: "ts_check",
    description: "TypeScript compiler diagnostics",
    systemPrompt: `Use ts_check to ask the compiler for exact type information and errors.
- mode 'project': Run full project check. Use BEFORE and AFTER edits to catch regressions.
- mode 'file': Check single file (faster). Use for incremental fixes.
- mode 'hover': Get type at specific line:col. Use when unsure about types.
- NEVER guess types. THE COMPILER IS ALWAYS RIGHT.
- Pay attention to strict mode errors - they're legitimate problems.`,
    tips: [
      "Run ts_check project before making large changes",
      "Use hover mode to verify variable/parameter types",
      "Always run ts_check after editing TypeScript files",
      "Check file mode is useful for quick iterations",
      "Pay attention to generic type constraints - they matter",
    ],
    commonMistakes: [
      "Guessing variable types instead of using ts_check hover",
      "Not running ts_check project after edits (regressions!)",
      "Ignoring strict mode errors - they're real problems",
      "Assuming imports work without ts_check verification",
    ],
  } as ToolPrompt,

  web_search: {
    name: "web_search",
    description: "Web search via API",
    systemPrompt: `Use web_search to find information on the internet.
- Requires API key (Brave Search or similar)
- Returns relevant snippets and URLs
- Use for finding documentation, examples, or current information
- Follow up with web_fetch for full page content`,
    tips: [
      "Use targeted search terms not whole questions",
      "Follow search results with web_fetch for full context",
      "Search for '[library] documentation' for official docs",
      "Add 'example' or 'tutorial' for learning resources",
    ],
    commonMistakes: [
      "Searching with a full question instead of keywords",
      "Not using web_fetch after search to get full context",
    ],
  } as ToolPrompt,

  browser_action: {
    name: "browser_action",
    description: "Browser automation with Playwright",
    systemPrompt: `Use browser_action to interact with web pages programmatically.
- navigate: Go to URL
- click: Click element by selector
- type: Enter text into field
- extract: Get page structure (Accessibility Tree)
- screenshot: Capture visual state
- Complex workflows: chain actions or use scripts
- ALWAYS extract to see page state before clicking`,
    tips: [
      "Start with extract to understand page structure",
      "Use descriptive selectors (data-testid, role, aria-label)",
      "Chain actions with && in timeout-safe pattern",
      "Screenshot to verify visual state",
      "Use extract after actions to verify they worked",
    ],
    commonMistakes: [
      "Trying to click without first extracting page structure",
      "Using fragile CSS selectors (.this .that .thing)",
      "Not waiting for elements to load before clicking",
      "Screenshots without context of what you're testing",
    ],
  } as ToolPrompt,

  spawn_agent: {
    name: "spawn_agent",
    description: "Delegate to specialized sub-agents",
    systemPrompt: `Use spawn_agent to delegate complex sub-tasks to specialized agents.
- 'explore': Fast codebase exploration, Q&A, search
- 'executor': Run commands, execute scripts
- 'web_surfer': Navigate web, extract information
- 'browser_agent': Complex browser automation
- Agents run autonomously - give clear task description
- Use mailbox to collect results from long-running tasks`,
    tips: [
      "Use explore for 'find files matching pattern X'",
      "Use executor for batch operations or scripts",
      "Use web_surfer when you need to navigate multiple pages",
      "Give agents detailed context about what you need",
      "Check mailbox for results from async tasks",
    ],
    commonMistakes: [
      "Giving vague task descriptions to agents",
      "Not providing enough context for agents to succeed",
      "Using spawn_agent for simple tasks (just do it directly)",
    ],
  } as ToolPrompt,
};

/**
 * Get prompt for a specific tool
 */
export function getToolPrompt(toolName: string): ToolPrompt | undefined {
  return TOOL_PROMPTS[toolName as keyof typeof TOOL_PROMPTS];
}

/**
 * Get all prompts as a system instruction injection
 */
export function buildToolPromptsSection(): string {
  const prompts = Object.values(TOOL_PROMPTS);
  let section = "## Tool Usage Guidelines\n\n";

  for (const prompt of prompts) {
    section += `### ${prompt.name}\n${prompt.systemPrompt}\n\n`;
  }

  return section;
}

/**
 * Get tips for a specific tool
 */
export function getToolTips(toolName: string): string {
  const prompt = getToolPrompt(toolName);
  if (!prompt) return "";

  return "💡 Tips:\n" + prompt.tips.map((tip) => `- ${tip}`).join("\n");
}

/**
 * Get common mistakes for a tool
 */
export function getCommonMistakes(toolName: string): string {
  const prompt = getToolPrompt(toolName);
  if (!prompt) return "";

  return "❌ Common mistakes:\n" + prompt.commonMistakes.map((mistake) => `- ${mistake}`).join("\n");
}
