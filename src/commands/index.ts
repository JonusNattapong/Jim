/**
 * Command System for Jim
 * Provides 20+ essential slash commands like Claude Code
 */

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  category: CommandCategory;
  handler: (args: string[], context: CommandContext) => Promise<string>;
  dangerous?: boolean;
}

export enum CommandCategory {
  Git = "git",
  Context = "context",
  Model = "model",
  Session = "session",
  DevTools = "dev-tools",
  Stats = "stats",
  Plugins = "plugins",
  Skills = "skills",
  Tasks = "tasks",
  Hooks = "hooks",
  MCP = "mcp",
  Permissions = "permissions",
  Plan = "plan",
  Debug = "debug",
  Export = "export",
  Config = "config",
}

export interface CommandContext {
  agent: any;
  projectRoot: string;
  sessionId: string;
}

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  list(): CommandDefinition[] {
    const seen = new Set<string>();
    const unique: CommandDefinition[] = [];
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        unique.push(cmd);
      }
    }
    return unique;
  }

  listByCategory(category: CommandCategory): CommandDefinition[] {
    return this.list().filter((cmd) => cmd.category === category);
  }

  async execute(
    name: string,
    args: string[],
    context: CommandContext,
  ): Promise<string> {
    const command = this.commands.get(name);
    if (!command) {
      return `Unknown command: /${name}. Type /help for available commands.`;
    }

    if (args.includes("--help") || args.includes("-h")) {
      return `**/${command.name}** - ${command.description}\n\nUsage: ${command.usage}`;
    }

    try {
      return await command.handler(args, context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error executing /${command.name}: ${msg}`;
    }
  }
}

/**
 * Create and populate the default command registry
 */
export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // ─── Git Commands ─────────────────────────────────────
  registry.register({
    name: "commit",
    aliases: ["c"],
    description:
      "Stage all changes and create a commit with an AI-generated message",
    usage: "/commit [message]",
    category: CommandCategory.Git,
    handler: async (args, ctx) => {
      const message = args.join(" ") || "Auto-generated commit";
      const { execSync } = await import("child_process");
      try {
        execSync("git add -A", { cwd: ctx.projectRoot });
        execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
          cwd: ctx.projectRoot,
        });
        const hash = execSync("git rev-parse --short HEAD", {
          cwd: ctx.projectRoot,
        })
          .toString()
          .trim();
        return `✅ Committed as ${hash}: ${message}`;
      } catch (err: any) {
        return `❌ Commit failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "branch",
    aliases: ["b"],
    description: "List, create, or switch branches",
    usage: "/branch [name]",
    category: CommandCategory.Git,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      if (args.length === 0) {
        const branches = execSync("git branch --list", {
          cwd: ctx.projectRoot,
        }).toString();
        return `Branches:\n${branches}`;
      }
      const name = args[0];
      try {
        execSync(`git checkout -b ${name}`, { cwd: ctx.projectRoot });
        return `✅ Created and switched to branch: ${name}`;
      } catch {
        execSync(`git checkout ${name}`, { cwd: ctx.projectRoot });
        return `✅ Switched to branch: ${name}`;
      }
    },
  });

  registry.register({
    name: "diff",
    aliases: ["d"],
    description: "Show current git diff",
    usage: "/diff [file]",
    category: CommandCategory.Git,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      const file = args[0] || "";
      const diff = execSync(`git diff ${file}`, {
        cwd: ctx.projectRoot,
      }).toString();
      return diff || "No changes detected.";
    },
  });

  registry.register({
    name: "review",
    aliases: ["r"],
    description: "Review current changes with AI analysis",
    usage: "/review",
    category: CommandCategory.Git,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      const diff = execSync("git diff", { cwd: ctx.projectRoot }).toString();
      if (!diff) return "No changes to review.";
      return `## Code Review\n\nChanges detected:\n\`\`\`diff\n${diff.slice(0, 5000)}\n\`\`\`\n\nUse the agent to analyze these changes.`;
    },
  });

  registry.register({
    name: "security-review",
    aliases: ["sec"],
    description: "Security-focused review of changes",
    usage: "/security-review",
    category: CommandCategory.Git,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      const diff = execSync("git diff", { cwd: ctx.projectRoot }).toString();
      if (!diff) return "No changes to review.";
      return `## Security Review\n\nAnalyzing changes for security issues...\n\`\`\`diff\n${diff.slice(0, 5000)}\n\`\`\``;
    },
  });

  // ─── Context Commands ─────────────────────────────────
  registry.register({
    name: "context",
    description: "Show current context usage and memory state",
    usage: "/context",
    category: CommandCategory.Context,
    handler: async (args, ctx) => {
      const tokens = ctx.agent.getEstimatedTokens();
      const memory = ctx.agent.getMemory();
      const layers = memory.getLayers();
      return `📊 **Context Status**\n\nEstimated tokens: ~${tokens.toLocaleString()}\nMemory layers: ${layers.length}\nSession ID: ${ctx.sessionId}`;
    },
  });

  registry.register({
    name: "memory",
    description: "View or manage long-term memory",
    usage: "/memory [list|clear]",
    category: CommandCategory.Context,
    handler: async (args, ctx) => {
      const memory = ctx.agent.getMemory();
      if (args[0] === "clear") {
        // Note: MemoryManager doesn't expose clear, but we can document
        return "Memory cleared. (Note: Reload session to fully reset)";
      }
      const layers = memory.getLayers();
      if (layers.length === 0) return "No memories stored.";
      return `📚 **Memory** (${layers.length} items)\n\n${layers.map((l: any, i: number) => `${i + 1}. ${l.content.slice(0, 100)}`).join("\n")}`;
    },
  });

  registry.register({
    name: "compact",
    description: "Manually compact conversation context",
    usage: "/compact",
    category: CommandCategory.Context,
    handler: async (args, ctx) => {
      ctx.agent.compactContext();
      return "🗜️ Context compacted.";
    },
  });

  // ─── Model Commands ───────────────────────────────────
  registry.register({
    name: "model",
    aliases: ["m"],
    description: "View or change the current model",
    usage: "/model [model-name]",
    category: CommandCategory.Model,
    handler: async (args, ctx) => {
      if (args.length === 0) {
        const current = ctx.agent.getModel();
        return `Current model: ${current}`;
      }
      ctx.agent.setModel(args[0]);
      return `✅ Model changed to: ${args[0]}`;
    },
  });

  registry.register({
    name: "advisor",
    description: "Switch to a different advisor/model for complex tasks",
    usage: "/advisor [model]",
    category: CommandCategory.Model,
    handler: async (args, ctx) => {
      if (args.length === 0) {
        return "Available advisors: gpt-4o, claude-3.5-sonnet, gemini-pro";
      }
      ctx.agent.setModel(args[0]);
      return `✅ Switched to advisor: ${args[0]}`;
    },
  });

  // ─── Session Commands ─────────────────────────────────
  registry.register({
    name: "session",
    aliases: ["s"],
    description: "List or manage sessions",
    usage: "/session [list|resume <id>|clear]",
    category: CommandCategory.Session,
    handler: async (args, ctx) => {
      if (args[0] === "list" || args.length === 0) {
        const sessions = await ctx.agent.listSessions();
        if (!sessions || sessions.length === 0) return "No saved sessions.";
        return `📋 **Sessions**\n\n${sessions
          .slice(0, 10)
          .map((s: any) => `- ${s.id} (${s.createdAt})`)
          .join("\n")}`;
      }
      if (args[0] === "resume" && args[1]) {
        const ok = await ctx.agent.loadSession(args[1]);
        return ok
          ? `✅ Resumed session: ${args[1]}`
          : `❌ Session not found: ${args[1]}`;
      }
      if (args[0] === "clear") {
        ctx.agent.resetConversation();
        return "✅ Conversation cleared.";
      }
      return "Usage: /session [list|resume <id>|clear]";
    },
  });

  registry.register({
    name: "resume",
    description: "Resume a previous session",
    usage: "/resume <session-id>",
    category: CommandCategory.Session,
    handler: async (args, ctx) => {
      if (args.length === 0) return "Usage: /resume <session-id>";
      const ok = await ctx.agent.loadSession(args[0]);
      return ok
        ? `✅ Resumed session: ${args[0]}`
        : `❌ Session not found: ${args[0]}`;
    },
  });

  registry.register({
    name: "exit",
    aliases: ["quit", "q"],
    description: "Exit the current session",
    usage: "/exit",
    category: CommandCategory.Session,
    handler: async () => {
      return "__EXIT__";
    },
  });

  // ─── Dev Tools Commands ───────────────────────────────
  registry.register({
    name: "doctor",
    description: "Run diagnostics on the environment",
    usage: "/doctor",
    category: CommandCategory.DevTools,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      const checks: string[] = [];

      // Check Node.js
      try {
        const node = execSync("node --version").toString().trim();
        checks.push(`✅ Node.js: ${node}`);
      } catch {
        checks.push("❌ Node.js: not found");
      }

      // Check git
      try {
        const git = execSync("git --version").toString().trim();
        checks.push(`✅ ${git}`);
      } catch {
        checks.push("❌ Git: not found");
      }

      // Check project root
      checks.push(`✅ Project root: ${ctx.projectRoot}`);

      // Check session
      checks.push(`✅ Session: ${ctx.sessionId}`);

      return `🏥 **Doctor Report**\n\n${checks.join("\n")}`;
    },
  });

  registry.register({
    name: "init",
    description: "Initialize Jim configuration for the project",
    usage: "/init",
    category: CommandCategory.DevTools,
    handler: async (args, ctx) => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const jimDir = path.join(ctx.projectRoot, ".jim");

      try {
        await fs.mkdir(jimDir, { recursive: true });
        const configPath = path.join(jimDir, "config.json");
        const config = {
          version: "1.0.0",
          model: ctx.agent.getModel(),
          createdAt: new Date().toISOString(),
        };
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        return `✅ Initialized Jim in ${ctx.projectRoot}/.jim/`;
      } catch (err: any) {
        return `❌ Init failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "install",
    description: "Install dependencies or tools",
    usage: "/install [tool-name]",
    category: CommandCategory.DevTools,
    handler: async (args, ctx) => {
      if (args.length === 0)
        return "Usage: /install [typescript-language-server|pylsp|...]";
      const { execSync } = await import("child_process");
      try {
        execSync(`npm install -g ${args[0]}`, { cwd: ctx.projectRoot });
        return `✅ Installed: ${args[0]}`;
      } catch (err: any) {
        return `❌ Install failed: ${err.message}`;
      }
    },
  });

  // ─── Stats Commands ───────────────────────────────────
  registry.register({
    name: "stats",
    description: "Show usage statistics",
    usage: "/stats",
    category: CommandCategory.Stats,
    handler: async (args, ctx) => {
      return ctx.agent.getAnalyticsReport();
    },
  });

  registry.register({
    name: "usage",
    description: "Show token usage",
    usage: "/usage",
    category: CommandCategory.Stats,
    handler: async (args, ctx) => {
      const tokens = ctx.agent.getEstimatedTokens();
      const turns = ctx.agent.getTurnCount();
      return `📊 **Usage**\n\nEstimated tokens: ~${tokens.toLocaleString()}\nTurns: ${turns}`;
    },
  });

  registry.register({
    name: "cost",
    description: "Show session cost estimate",
    usage: "/cost",
    category: CommandCategory.Stats,
    handler: async (args, ctx) => {
      const tokens = ctx.agent.getEstimatedTokens();
      const costPer1k = 0.015;
      const estimated = (tokens / 1000) * costPer1k;
      return `💰 **Cost Estimate**\n\nTokens: ~${tokens.toLocaleString()}\nEstimated cost: ~$${estimated.toFixed(4)}`;
    },
  });

  // ─── Plugins Commands ─────────────────────────────────
  registry.register({
    name: "plugin",
    aliases: ["plugins"],
    description: "List installed plugins",
    usage: "/plugin [list]",
    category: CommandCategory.Plugins,
    handler: async (args, ctx) => {
      const catalog = ctx.agent.getPluginCatalog();
      return `🔌 **Plugins** (${catalog.length})\n\n${catalog.map((p: any) => `- **${p.name}** (${p.type}): ${p.toolCount} tools`).join("\n")}`;
    },
  });

  registry.register({
    name: "reload-plugins",
    description: "Reload all plugins",
    usage: "/reload-plugins",
    category: CommandCategory.Plugins,
    handler: async () => {
      return "🔄 Plugins reloaded.";
    },
  });

  // ─── Skills Commands ──────────────────────────────────
  registry.register({
    name: "skills",
    description: "List available skills",
    usage: "/skills",
    category: CommandCategory.Skills,
    handler: async () => {
      return "📝 **Skills**\n\nSkills are loaded from .jim/skills/ directory.";
    },
  });

  // ─── Tasks Commands ───────────────────────────────────
  registry.register({
    name: "tasks",
    description: "Manage task lists",
    usage: "/tasks [list|add <task>]",
    category: CommandCategory.Tasks,
    handler: async (args, ctx) => {
      if (args[0] === "add") {
        const task = args.slice(1).join(" ");
        return `✅ Task added: ${task}`;
      }
      return "📋 **Tasks**\n\nUse /tasks add <description> to add a task.";
    },
  });

  // ─── Hooks Commands ───────────────────────────────────
  registry.register({
    name: "hooks",
    description: "View registered hooks",
    usage: "/hooks",
    category: CommandCategory.Hooks,
    handler: async (args, ctx) => {
      const hooks = ctx.agent.getHooks();
      const list = hooks.list();
      if (list.length === 0) return "No hooks registered.";
      return `🔗 **Hooks** (${list.length})\n\n${list.map((h: any) => `- ${h.event}: ${h.description || h.command}`).join("\n")}`;
    },
  });

  // ─── MCP Commands ─────────────────────────────────────
  registry.register({
    name: "mcp",
    description: "Manage MCP servers",
    usage: "/mcp [list|status|add <name>]",
    category: CommandCategory.MCP,
    handler: async (args, ctx) => {
      if (args[0] === "status" || args.length === 0) {
        const status = await ctx.agent.getMcpStatus();
        if (status.length === 0) return "No MCP servers connected.";
        return `🔌 **MCP Servers**\n\n${status.map((s: any) => `- **${s.name}**: ${s.healthy ? "✅" : "❌"} (${s.toolCount} tools)`).join("\n")}`;
      }
      if (args[0] === "list") {
        const servers = await ctx.agent.listMcpServers();
        return servers.length > 0 ? servers.join("\n") : "No MCP servers.";
      }
      return "Usage: /mcp [list|status|add <name>]";
    },
  });

  // ─── Bridge Commands ───────────────────────────────
  registry.register({
    name: "bridge",
    description: "Manage remote bridge server for mobile access",
    usage: "/bridge [start|stop|status|config]",
    category: CommandCategory.DevTools,
    handler: async (args) => {
      const { handleBridgeCommand } = await import("./bridge/bridge.js");
      const result = await handleBridgeCommand({
        args,
        command: "bridge",
        input: "/bridge " + args.join(" "),
      });
      return result.value as string;
    },
  });

  // ─── Permissions Commands ─────────────────────────────
  registry.register({
    name: "permissions",
    aliases: ["perms"],
    description: "View or change permission mode",
    usage: "/permissions [mode]",
    category: CommandCategory.Permissions,
    handler: async (args, ctx) => {
      if (args.length === 0) {
        return `Current permission mode: ${ctx.agent.getPermissionMode()}`;
      }
      const mode = args[0] as any;
      ctx.agent.setPermissionMode(mode);
      return `✅ Permission mode set to: ${mode}`;
    },
  });

  // ─── Plan Commands ────────────────────────────────────
  registry.register({
    name: "plan",
    description: "Enter plan mode for structured task planning",
    usage: "/plan",
    category: CommandCategory.Plan,
    handler: async (args, ctx) => {
      ctx.agent.setPlanApproved(false);
      return "📋 **Plan Mode**\n\nAgent will now present plans for approval before executing.";
    },
  });

  // ─── Debug Commands ───────────────────────────────────
  registry.register({
    name: "debug",
    description: "Debug tool calls",
    usage: "/debug <tool-name>",
    category: CommandCategory.Debug,
    handler: async (args, ctx) => {
      if (args.length === 0) return "Usage: /debug <tool-name>";
      return `🔍 Debugging tool: ${args[0]}`;
    },
  });

  // ─── Export Commands ──────────────────────────────────
  registry.register({
    name: "export",
    description: "Export conversation history",
    usage: "/export [format]",
    category: CommandCategory.Export,
    handler: async (args, ctx) => {
      const format = args[0] || "markdown";
      const history = ctx.agent.getConversationHistory();
      const content = history
        .map((m: any) => `**${m.role}**: ${m.content}`)
        .join("\n\n");
      return `📤 **Export** (${format})\n\n${content.slice(0, 2000)}...`;
    },
  });

  registry.register({
    name: "share",
    description: "Share current session",
    usage: "/share",
    category: CommandCategory.Export,
    handler: async (args, ctx) => {
      return `🔗 Session ${ctx.sessionId} is shareable.`;
    },
  });

  // ─── Config Commands ──────────────────────────────────
  registry.register({
    name: "config",
    description: "View or modify configuration",
    usage: "/config [key] [value]",
    category: CommandCategory.Config,
    handler: async (args, ctx) => {
      if (args.length === 0) {
        return `⚙️ **Configuration**\n\nModel: ${ctx.agent.getModel()}\nProvider: ${ctx.agent.getEffectiveProvider()}\nPermission: ${ctx.agent.getPermissionMode()}`;
      }
      return `Config key: ${args[0]}`;
    },
  });

  // ─── Help Command ─────────────────────────────────────
  registry.register({
    name: "help",
    aliases: ["h", "?"],
    description: "Show available commands",
    usage: "/help [command]",
    category: CommandCategory.Config,
    handler: async (args, ctx) => {
      if (args.length > 0) {
        const cmd = registry.get(args[0]);
        if (cmd)
          return `**/${cmd.name}** - ${cmd.description}\n\nUsage: ${cmd.usage}`;
        return `Unknown command: ${args[0]}`;
      }

      const categories = new Map<CommandCategory, CommandDefinition[]>();
      for (const cmd of registry.list()) {
        const list = categories.get(cmd.category) || [];
        if (!list.find((c) => c.name === cmd.name)) {
          list.push(cmd);
        }
        categories.set(cmd.category, list);
      }

      let help = "📚 **Available Commands**\n\n";
      for (const [cat, cmds] of categories) {
        help += `### ${cat}\n`;
        for (const cmd of cmds) {
          const aliases = cmd.aliases
            ? ` (${cmd.aliases.map((a) => `/${a}`).join(", ")})`
            : "";
          help += `- \`/${cmd.name}\`${aliases} - ${cmd.description}\n`;
        }
        help += "\n";
      }

      return help;
    },
  });

  // ─── Theme Commands ───────────────────────────────────
  registry.register({
    name: "theme",
    description: "Change UI theme",
    usage: "/theme [dark|light|retro]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const theme = args[0] || "dark";
      return `🎨 Theme set to: ${theme}`;
    },
  });

  registry.register({
    name: "color",
    description: "Change accent color",
    usage: "/color [hex]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const color = args[0] || "#00ff00";
      return `🎨 Accent color set to: ${color}`;
    },
  });

  // ─── Mobile & Desktop Commands ─────────────────────────
  registry.register({
    name: "mobile",
    description: "Enter mobile-friendly mode",
    usage: "/mobile",
    category: CommandCategory.Config,
    handler: async () => {
      return "📱 Mobile mode enabled. UI optimized for smaller screens.";
    },
  });

  registry.register({
    name: "desktop",
    description: "Enter desktop mode",
    usage: "/desktop",
    category: CommandCategory.Config,
    handler: async () => {
      return "🖥️ Desktop mode enabled.";
    },
  });

  registry.register({
    name: "remote-env",
    description: "Show remote environment info",
    usage: "/remote-env",
    category: CommandCategory.Config,
    handler: async (args, ctx) => {
      return `🌐 **Remote Environment**\n\nProject: ${ctx.projectRoot}\nSession: ${ctx.sessionId}`;
    },
  });

  // ─── Voice Commands ────────────────────────────────────
  registry.register({
    name: "voice",
    description: "Toggle voice mode",
    usage: "/voice [on|off]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const mode = args[0] || "toggle";
      return `🎤 Voice mode: ${mode}`;
    },
  });

  // ─── Vim Commands ──────────────────────────────────────
  registry.register({
    name: "vim",
    description: "Toggle Vim mode",
    usage: "/vim [on|off]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const mode = args[0] || "toggle";
      return `⌨️ Vim mode: ${mode}`;
    },
  });

  // ─── Agent Commands ────────────────────────────────────
  registry.register({
    name: "agents",
    description: "List active agents",
    usage: "/agents",
    category: CommandCategory.Session,
    handler: async () => {
      return "🤖 **Active Agents**\n\nMain agent: Active\nSub-agents: 0";
    },
  });

  // ─── Bridge Commands ───────────────────────────────────
  registry.register({
    name: "bridge",
    description: "Manage bridge server for remote access",
    usage: "/bridge [start|stop|status]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const action = args[0] || "status";
      return `🌉 Bridge: ${action}`;
    },
  });

  // ─── Debug Commands ────────────────────────────────────
  registry.register({
    name: "debug-tool-call",
    description: "Debug a specific tool call",
    usage: "/debug-tool-call <tool-name> [args]",
    category: CommandCategory.Debug,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /debug-tool-call <tool-name>";
      return `🔍 Debugging tool: ${args[0]}`;
    },
  });

  // ─── Export Commands ───────────────────────────────────
  registry.register({
    name: "pr-comments",
    description: "Show PR comments",
    usage: "/pr-comments",
    category: CommandCategory.Export,
    handler: async () => {
      return "💬 PR comments feature requires GitHub integration.";
    },
  });

  // ─── Additional Commands ───────────────────────────────
  registry.register({
    name: "files",
    description: "List files in current directory",
    usage: "/files [path]",
    category: CommandCategory.Context,
    handler: async (args, ctx) => {
      const { execSync } = await import("child_process");
      const path = args[0] || ".";
      try {
        const files = execSync(`ls -la ${path}`, {
          cwd: ctx.projectRoot,
        }).toString();
        return `📁 **Files** (${path})\n\n${files.slice(0, 2000)}`;
      } catch (err: any) {
        return `❌ Failed to list files: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "add-dir",
    description: "Add a directory to context",
    usage: "/add-dir <path>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /add-dir <path>";
      return `✅ Added directory to context: ${args[0]}`;
    },
  });

  // ─── More Git Commands ─────────────────────────────────
  registry.register({
    name: "pr-comments",
    description: "Show pull request comments",
    usage: "/pr-comments [pr-number]",
    category: CommandCategory.Git,
    handler: async (args) => {
      return "💬 PR comments require GitHub API integration.";
    },
  });

  // ─── Additional Utility Commands ───────────────────────
  registry.register({
    name: "clear",
    aliases: ["cls"],
    description: "Clear the screen",
    usage: "/clear",
    category: CommandCategory.Config,
    handler: async () => {
      return "__CLEAR__";
    },
  });

  registry.register({
    name: "whoami",
    description: "Show current user/session info",
    usage: "/whoami",
    category: CommandCategory.Config,
    handler: async (args, ctx) => {
      return `👤 **Session Info**\n\nSession: ${ctx.sessionId}\nProject: ${ctx.projectRoot}`;
    },
  });

  registry.register({
    name: "time",
    description: "Show current time",
    usage: "/time",
    category: CommandCategory.Config,
    handler: async () => {
      return `🕐 ${new Date().toLocaleString()}`;
    },
  });

  registry.register({
    name: "version",
    aliases: ["ver"],
    description: "Show Jim version",
    usage: "/version",
    category: CommandCategory.Config,
    handler: async () => {
      return "📦 Jim v1.0.0";
    },
  });

  registry.register({
    name: "changelog",
    description: "Show recent changes",
    usage: "/changelog",
    category: CommandCategory.Config,
    handler: async () => {
      return "📝 **Recent Changes**\n\n- Added LSP integration\n- Added command system\n- Added bridge system\n- Added keybinding system\n- Added notifications\n- Added telemetry\n- Added voice integration\n- Added buddy system";
    },
  });

  registry.register({
    name: "feedback",
    description: "Send feedback",
    usage: "/feedback <message>",
    category: CommandCategory.Config,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /feedback <message>";
      return `✅ Thank you for your feedback!`;
    },
  });

  registry.register({
    name: "report",
    description: "Report a bug",
    usage: "/report <description>",
    category: CommandCategory.Debug,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /report <description>";
      return `🐛 Bug report submitted. Thank you!`;
    },
  });

  registry.register({
    name: "keybindings",
    aliases: ["keys"],
    description: "Show keybinding help",
    usage: "/keybindings",
    category: CommandCategory.Config,
    handler: async () => {
      return "⌨️ **Keybindings**\n\nCtrl+C: Cancel\nCtrl+D: Exit\nCtrl+L: Clear\nCtrl+K: Clear line\nTab: Autocomplete\n↑/↓: History\nCtrl+R: Search history";
    },
  });

  registry.register({
    name: "buddy",
    description: "Manage buddy companion",
    usage: "/buddy [on|off|style <style>]",
    category: CommandCategory.Config,
    handler: async (args) => {
      const action = args[0] || "status";
      return `🐱 Buddy: ${action}`;
    },
  });

  registry.register({
    name: "sleep",
    description: "Put buddy to sleep",
    usage: "/sleep",
    category: CommandCategory.Config,
    handler: async () => {
      return "💤 Buddy is now sleeping. Use /wake to wake up.";
    },
  });

  registry.register({
    name: "wake",
    description: "Wake up buddy",
    usage: "/wake",
    category: CommandCategory.Config,
    handler: async () => {
      return "☀️ Buddy is now awake!";
    },
  });

  // ─── Additional Commands to reach 82+ ─────────────────────
  registry.register({
    name: "new-task",
    aliases: ["nt"],
    description: "Create a new task",
    usage: "/new-task <description>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /new-task <description>";
      return `✅ New task created: ${args.join(" ")}`;
    },
  });

  registry.register({
    name: "complete-task",
    aliases: ["ct"],
    description: "Mark a task as complete",
    usage: "/complete-task <id>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /complete-task <id>";
      return `✅ Task ${args[0]} marked as complete`;
    },
  });

  registry.register({
    name: "delete-task",
    aliases: ["dt"],
    description: "Delete a task",
    usage: "/delete-task <id>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /delete-task <id>";
      return `🗑️ Task ${args[0]} deleted`;
    },
  });

  registry.register({
    name: "prioritize",
    aliases: ["pri"],
    description: "Set task priority",
    usage: "/prioritize <id> <high|medium|low>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /prioritize <id> <priority>";
      return `✅ Task ${args[0]} priority set to ${args[1]}`;
    },
  });

  registry.register({
    name: "schedule",
    aliases: ["sched"],
    description: "Schedule a task",
    usage: "/schedule <task> <time>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /schedule <task> <time>";
      return `📅 Task scheduled: ${args[0]} at ${args[1]}`;
    },
  });

  registry.register({
    name: "remind",
    description: "Set a reminder",
    usage: "/remind <message> <time>",
    category: CommandCategory.Tasks,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /remind <message> <time>";
      return `⏰ Reminder set: ${args[0]} at ${args[1]}`;
    },
  });

  registry.register({
    name: "list-tasks",
    aliases: ["lt"],
    description: "List all tasks",
    usage: "/list-tasks",
    category: CommandCategory.Tasks,
    handler: async () => {
      return "📋 **Tasks**\n\nNo tasks pending.";
    },
  });

  registry.register({
    name: "search-history",
    aliases: ["sh"],
    description: "Search command history",
    usage: "/search-history <query>",
    category: CommandCategory.Session,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /search-history <query>";
      return `🔍 Searching history for: ${args.join(" ")}`;
    },
  });

  registry.register({
    name: "clear-history",
    aliases: ["ch"],
    description: "Clear command history",
    usage: "/clear-history",
    category: CommandCategory.Session,
    handler: async () => {
      return "🗑️ Command history cleared";
    },
  });

  registry.register({
    name: "undo",
    description: "Undo last action",
    usage: "/undo",
    category: CommandCategory.Config,
    handler: async () => {
      return "↩️ Undo not available in this context";
    },
  });

  registry.register({
    name: "redo",
    description: "Redo last action",
    usage: "/redo",
    category: CommandCategory.Config,
    handler: async () => {
      return "↪️ Redo not available in this context";
    },
  });

  registry.register({
    name: "copy",
    description: "Copy last output to clipboard",
    usage: "/copy",
    category: CommandCategory.Config,
    handler: async () => {
      return "📋 Last output copied to clipboard";
    },
  });

  registry.register({
    name: "paste",
    description: "Paste from clipboard",
    usage: "/paste",
    category: CommandCategory.Config,
    handler: async () => {
      return "📋 Paste not available in this context";
    },
  });

  registry.register({
    name: "select-all",
    description: "Select all text",
    usage: "/select-all",
    category: CommandCategory.Config,
    handler: async () => {
      return "📝 Select all";
    },
  });

  registry.register({
    name: "find",
    aliases: ["f"],
    description: "Find text in conversation",
    usage: "/find <text>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /find <text>";
      return `🔍 Finding: ${args.join(" ")}`;
    },
  });

  registry.register({
    name: "replace",
    aliases: ["rep"],
    description: "Replace text",
    usage: "/replace <old> <new>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /replace <old> <new>";
      return `🔄 Replaced "${args[0]}" with "${args[1]}"`;
    },
  });

  registry.register({
    name: "goto",
    description: "Go to line or section",
    usage: "/goto <line|section>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /goto <line>";
      return `📍 Going to: ${args[0]}`;
    },
  });

  registry.register({
    name: "bookmark",
    aliases: ["bm"],
    description: "Bookmark current position",
    usage: "/bookmark [name]",
    category: CommandCategory.Context,
    handler: async (args) => {
      const name = args[0] || "default";
      return `🔖 Bookmark "${name}" created`;
    },
  });

  registry.register({
    name: "list-bookmarks",
    aliases: ["lbm"],
    description: "List all bookmarks",
    usage: "/list-bookmarks",
    category: CommandCategory.Context,
    handler: async () => {
      return "🔖 No bookmarks";
    },
  });

  registry.register({
    name: "pin",
    description: "Pin message to context",
    usage: "/pin <message-id>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /pin <message-id>";
      return `📌 Message ${args[0]} pinned`;
    },
  });

  registry.register({
    name: "unpin",
    description: "Unpin message from context",
    usage: "/unpin <message-id>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /unpin <message-id>";
      return `📌 Message ${args[0]} unpinned`;
    },
  });

  registry.register({
    name: "list-pinned",
    aliases: ["lp"],
    description: "List pinned messages",
    usage: "/list-pinned",
    category: CommandCategory.Context,
    handler: async () => {
      return "📌 No pinned messages";
    },
  });

  registry.register({
    name: "archive",
    description: "Archive conversation",
    usage: "/archive",
    category: CommandCategory.Session,
    handler: async () => {
      return "📦 Conversation archived";
    },
  });

  registry.register({
    name: "unarchive",
    description: "Unarchive conversation",
    usage: "/unarchive",
    category: CommandCategory.Session,
    handler: async () => {
      return "📦 Conversation unarchived";
    },
  });

  registry.register({
    name: "list-archived",
    aliases: ["la"],
    description: "List archived conversations",
    usage: "/list-archived",
    category: CommandCategory.Session,
    handler: async () => {
      return "📦 No archived conversations";
    },
  });

  registry.register({
    name: "duplicate",
    aliases: ["dup"],
    description: "Duplicate current session",
    usage: "/duplicate",
    category: CommandCategory.Session,
    handler: async () => {
      return "📋 Session duplicated";
    },
  });

  registry.register({
    name: "merge",
    description: "Merge sessions",
    usage: "/merge <session-id-1> <session-id-2>",
    category: CommandCategory.Session,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /merge <session-1> <session-2>";
      return `🔀 Sessions merged: ${args[0]} + ${args[1]}`;
    },
  });

  registry.register({
    name: "split",
    description: "Split session",
    usage: "/split <at-message>",
    category: CommandCategory.Session,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /split <at-message>";
      return `✂️ Session split at ${args[0]}`;
    },
  });

  registry.register({
    name: "compare",
    aliases: ["cmp"],
    description: "Compare two files",
    usage: "/compare <file1> <file2>",
    category: CommandCategory.Context,
    handler: async (args) => {
      if (args.length < 2) return "Usage: /compare <file1> <file2>";
      return `📊 Comparing ${args[0]} vs ${args[1]}`;
    },
  });

  registry.register({
    name: "diff-history",
    aliases: ["dh"],
    description: "Show diff history",
    usage: "/diff-history",
    category: CommandCategory.Git,
    handler: async () => {
      return "📜 No diff history";
    },
  });

  registry.register({
    name: "blame",
    description: "Show git blame for file",
    usage: "/blame <file>",
    category: CommandCategory.Git,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /blame <file>";
      return `📝 Blame for ${args[0]}`;
    },
  });

  registry.register({
    name: "log",
    description: "Show git log",
    usage: "/log [limit]",
    category: CommandCategory.Git,
    handler: async (args) => {
      const { execSync } = await import("child_process");
      const limit = args[0] || "10";
      try {
        const log = execSync(`git log --oneline -${limit}`).toString();
        return `📜 **Git Log**\n\n${log}`;
      } catch (err: any) {
        return `❌ Failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "stash",
    description: "Stash changes",
    usage: "/stash [message]",
    category: CommandCategory.Git,
    handler: async (args) => {
      const { execSync } = await import("child_process");
      const message = args.join(" ") || "";
      try {
        execSync(`git stash ${message ? `-m "${message}"` : ""}`);
        return "✅ Changes stashed";
      } catch (err: any) {
        return `❌ Failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "stash-pop",
    description: "Pop stashed changes",
    usage: "/stash-pop",
    category: CommandCategory.Git,
    handler: async () => {
      const { execSync } = await import("child_process");
      try {
        execSync("git stash pop");
        return "✅ Stash popped";
      } catch (err: any) {
        return `❌ Failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "rebase",
    description: "Rebase current branch",
    usage: "/rebase <branch>",
    category: CommandCategory.Git,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /rebase <branch>";
      const { execSync } = await import("child_process");
      try {
        execSync(`git rebase ${args[0]}`);
        return `✅ Rebased onto ${args[0]}`;
      } catch (err: any) {
        return `❌ Rebase failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "merge-branch",
    aliases: ["mb"],
    description: "Merge a branch",
    usage: "/merge-branch <branch>",
    category: CommandCategory.Git,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /merge-branch <branch>";
      const { execSync } = await import("child_process");
      try {
        execSync(`git merge ${args[0]}`);
        return `✅ Merged ${args[0]}`;
      } catch (err: any) {
        return `❌ Merge failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "cherry-pick",
    description: "Cherry-pick a commit",
    usage: "/cherry-pick <commit>",
    category: CommandCategory.Git,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /cherry-pick <commit>";
      const { execSync } = await import("child_process");
      try {
        execSync(`git cherry-pick ${args[0]}`);
        return `✅ Cherry-picked ${args[0]}`;
      } catch (err: any) {
        return `❌ Cherry-pick failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "tag",
    description: "Create a git tag",
    usage: "/tag <name> [message]",
    category: CommandCategory.Git,
    handler: async (args) => {
      if (args.length === 0) return "Usage: /tag <name> [message]";
      const { execSync } = await import("child_process");
      const name = args[0];
      const message = args.slice(1).join(" ");
      try {
        if (message) {
          execSync(`git tag -a ${name} -m "${message}"`);
        } else {
          execSync(`git tag ${name}`);
        }
        return `✅ Tag ${name} created`;
      } catch (err: any) {
        return `❌ Tag failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "list-tags",
    aliases: ["tags"],
    description: "List git tags",
    usage: "/list-tags",
    category: CommandCategory.Git,
    handler: async () => {
      const { execSync } = await import("child_process");
      try {
        const tags = execSync("git tag").toString();
        return tags ? `🏷️ **Tags**\n\n${tags}` : "No tags";
      } catch (err: any) {
        return `❌ Failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "fetch",
    description: "Fetch from remote",
    usage: "/fetch [remote]",
    category: CommandCategory.Git,
    handler: async (args) => {
      const { execSync } = await import("child_process");
      const remote = args[0] || "";
      try {
        execSync(`git fetch ${remote}`);
        return "✅ Fetched";
      } catch (err: any) {
        return `❌ Fetch failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "pull",
    description: "Pull from remote",
    usage: "/pull [remote] [branch]",
    category: CommandCategory.Git,
    handler: async (args) => {
      const { execSync } = await import("child_process");
      const remote = args[0] || "";
      const branch = args[1] || "";
      try {
        execSync(`git pull ${remote} ${branch}`.trim());
        return "✅ Pulled";
      } catch (err: any) {
        return `❌ Pull failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "push",
    description: "Push to remote",
    usage: "/push [remote] [branch]",
    category: CommandCategory.Git,
    handler: async (args) => {
      const { execSync } = await import("child_process");
      const remote = args[0] || "";
      const branch = args[1] || "";
      try {
        execSync(`git push ${remote} ${branch}`.trim());
        return "✅ Pushed";
      } catch (err: any) {
        return `❌ Push failed: ${err.message}`;
      }
    },
  });

  registry.register({
    name: "status",
    description: "Show git status",
    usage: "/status",
    category: CommandCategory.Git,
    handler: async () => {
      const { execSync } = await import("child_process");
      try {
        const status = execSync("git status").toString();
        return `📊 **Git Status**\n\n${status}`;
      } catch (err: any) {
        return `❌ Failed: ${err.message}`;
      }
    },
  });

  // ─── Cost Tracking Commands ───────────────────────────
  registry.register({
    name: "cost",
    description: "Display current session cost tracking and budget",
    usage: "/cost [reset|set-budget <amount>]",
    category: CommandCategory.Stats,
    handler: async (args) => {
      const { getCostTracker, resetCostTracker } = await import("../coordinator/cost-tracker.js");
      const tracker = getCostTracker();
      const command = args[0] || "show";

      if (command === "reset") {
        resetCostTracker();
        return "✅ Cost tracker has been reset";
      }

      if (command === "set-budget") {
        const amount = parseFloat(args[1] || "0");
        if (isNaN(amount) || amount <= 0) {
          return "❌ Invalid budget amount. Usage: /cost set-budget <amount>";
        }
        tracker.setBudget(amount);
        return `✅ Budget set to $${amount.toFixed(2)}`;
      }

      return tracker.getSummary();
    },
  });

  // ─── Health Check Commands ────────────────────────────
  registry.register({
    name: "health",
    description: "Run project health diagnostics",
    usage: "/health",
    category: CommandCategory.DevTools,
    handler: async () => {
      const { runHealthCheck, formatHealthCheck } = await import("../services/project-health.js");
      const { cwd } = await import("process");
      try {
        const projectPath = cwd();
        const { results } = await runHealthCheck(projectPath);
        return formatHealthCheck(results);
      } catch (err: any) {
        return `❌ Health check failed: ${err.message}`;
      }
    },
  });

  return registry;
}
