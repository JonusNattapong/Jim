import { childLogger } from "../utils/logger.js";
import type { ToolDefinition, ToolHandler } from "../tools/types.js";

export interface PluginMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  type: "built-in" | "mcp" | "custom";
}

export interface Plugin {
  metadata: PluginMetadata;
  tools: Array<{
    definition: ToolDefinition;
    handler: ToolHandler;
  }>;
  enabled: boolean;
}

export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private log = childLogger({ component: "plugin-manager" });

  registerPlugin(plugin: Plugin): void {
    this.plugins.set(plugin.metadata.name, plugin);
    this.log.info({ plugin: plugin.metadata.name, toolCount: plugin.tools.length }, "plugin registered");
  }

  getEnabledTools(): Array<{ name: string; definition: ToolDefinition; handler: ToolHandler }> {
    const allTools: Array<{ name: string; definition: ToolDefinition; handler: ToolHandler }> = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        for (const tool of plugin.tools) {
          allTools.push({
            name: tool.definition.function.name,
            definition: tool.definition,
            handler: tool.handler,
          });
        }
      }
    }
    return allTools;
  }

  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(p => p.metadata);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  setPluginEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = enabled;
      return true;
    }
    return false;
  }
}
