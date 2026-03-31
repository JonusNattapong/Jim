import type { CommandDefinition, CommandResult } from "./types.js";

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>();

  register(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      this.aliases.set(alias, cmd.name);
    }
  }

  get(name: string): CommandDefinition | undefined {
    const resolved = this.aliases.get(name) ?? name;
    return this.commands.get(resolved);
  }

  list(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  search(query: string): CommandDefinition[] {
    const q = query.toLowerCase();
    return this.list().filter(c =>
      c.name.includes(q) || c.description.toLowerCase().includes(q) || c.aliases.some(a => a.includes(q))
    );
  }

  async execute(name: string, args: string[], context?: any): Promise<CommandResult> {
    const cmd = this.get(name);
    if (!cmd) return { success: false, output: "", error: "Unknown command: " + name };
    try {
      return await cmd.handler(args, context);
    } catch (err) {
      return { success: false, output: "", error: err.message };
    }
  }

  getByCategory(category: string): CommandDefinition[] {
    return this.list().filter(c => c.category === category);
  }
}

export const commandRegistry = new CommandRegistry();
export { CommandRegistry };
