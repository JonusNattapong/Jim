import type {
  EnhancedCommandDefinition,
  CommandDefinition,
  CommandResult,
  CommandContext,
  LocalCommandCall,
  LocalJSXCommandCall,
} from "./types.js";

class CommandRegistry {
  private commands = new Map<string, EnhancedCommandDefinition | CommandDefinition>();
  private aliases = new Map<string, string>();
  private loadedCalls = new Map<string, LocalCommandCall | LocalJSXCommandCall>();

  register(cmd: EnhancedCommandDefinition | CommandDefinition): void {
    this.commands.set(cmd.name, cmd);
    if ("aliases" in cmd && cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliases.set(alias, cmd.name);
      }
    }
  }

  get(name: string): EnhancedCommandDefinition | CommandDefinition | undefined {
    const resolved = this.aliases.get(name) ?? name;
    return this.commands.get(resolved);
  }

  list(): (EnhancedCommandDefinition | CommandDefinition)[] {
    return Array.from(this.commands.values());
  }

  listVisible(): (EnhancedCommandDefinition | CommandDefinition)[] {
    return this.list().filter((cmd) => {
      if ("isHidden" in cmd) return !cmd.isHidden;
      return true;
    });
  }

  search(query: string): (EnhancedCommandDefinition | CommandDefinition)[] {
    const q = query.toLowerCase();
    return this.listVisible().filter((c) => {
      const name = c.name.includes(q);
      const desc = c.description.toLowerCase().includes(q);
      const alias =
        "aliases" in c && c.aliases
          ? c.aliases.some((a: string) => a.includes(q))
          : false;
      return name || desc || alias;
    });
  }

  async execute(
    name: string,
    args: string,
    context: CommandContext
  ): Promise<CommandResult> {
    const cmd = this.get(name);
    if (!cmd) {
      return {
        type: "error",
        value: `Unknown command: /${name}. Type /help for available commands.`,
      };
    }

    // Check if enabled
    if ("isEnabled" in cmd && cmd.isEnabled) {
      const enabled = await cmd.isEnabled();
      if (!enabled) {
        return {
          type: "error",
          value: `Command /${name} is not available in this context.`,
        };
      }
    }

    try {
      // Enhanced command with lazy loading
      if ("load" in cmd && cmd.load) {
        let call = this.loadedCalls.get(name);
        if (!call) {
          const module = await cmd.load();
          call = module.call;
          this.loadedCalls.set(name, call);
        }
        return await (call as LocalCommandCall)(args, context);
      }

      // Legacy handler
      if ("handler" in cmd && cmd.handler) {
        const argArray = args.trim().split(/\s+/).filter((a) => a);
        const result = await (cmd.handler as any)(argArray, context);
        return {
          type: "text",
          value: typeof result === "string" ? result : JSON.stringify(result),
        };
      }

      return {
        type: "error",
        value: `Command /${name} has no handler.`,
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err);
      return {
        type: "error",
        value: `Error executing /${name}: ${msg}`,
      };
    }
  }

  getByCategory(
    category: string
  ): (EnhancedCommandDefinition | CommandDefinition)[] {
    return this.listVisible().filter((c) => c.category === category);
  }
}

export const commandRegistry = new CommandRegistry();
export { CommandRegistry };
