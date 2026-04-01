/**
 * Plugin Registry
 * Manages plugin registration, lifecycle, and discovery
 */

import fs from "fs/promises";
import path from "path";
import { childLogger } from "../utils/logger.js";

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
  main?: string;
  tools?: string[];
  commands?: string[];
  hooks?: string[];
  dependencies?: Record<string, string>;
}

export interface Plugin {
  metadata: PluginMetadata;
  path: string;
  enabled: boolean;
  loadedAt?: number;
  tools?: Map<string, any>;
  commands?: Map<string, any>;
  hooks?: Map<string, any>;
}

export interface PluginManifest {
  plugins: PluginMetadata[];
}

const log = childLogger({ component: "plugin-registry" });

class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private pluginDir: string;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.pluginDir, { recursive: true });
      await this.discoverPlugins();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to initialize plugin registry: ${msg}`);
    }
  }

  async discoverPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(
            this.pluginDir,
            entry.name,
            "plugin.json",
          );
          try {
            const manifestData = await fs.readFile(manifestPath, "utf-8");
            const metadata: PluginMetadata = JSON.parse(manifestData);
            this.registerPlugin(
              metadata,
              path.join(this.pluginDir, entry.name),
            );
          } catch {
            // Skip directories without plugin.json
          }
        }
      }
      log.info(`Discovered ${this.plugins.size} plugins`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to discover plugins: ${msg}`);
    }
  }

  registerPlugin(metadata: PluginMetadata, pluginPath: string): void {
    const plugin: Plugin = {
      metadata,
      path: pluginPath,
      enabled: true,
      loadedAt: Date.now(),
      tools: new Map(),
      commands: new Map(),
      hooks: new Map(),
    };
    this.plugins.set(metadata.name, plugin);
    log.debug(`Registered plugin: ${metadata.name} v${metadata.version}`);
  }

  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = false;
      this.plugins.delete(name);
      log.debug(`Unregistered plugin: ${name}`);
      return true;
    }
    return false;
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  listEnabledPlugins(): Plugin[] {
    return this.listPlugins().filter((p) => p.enabled);
  }

  async loadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    try {
      // Load plugin main file if exists
      if (plugin.metadata.main) {
        const mainPath = path.join(plugin.path, plugin.metadata.main);
        await import(mainPath);
        log.info(`Loaded plugin: ${name}`);
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to load plugin ${name}: ${msg}`);
      return false;
    }
  }

  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    plugin.enabled = false;
    plugin.tools?.clear();
    plugin.commands?.clear();
    plugin.hooks?.clear();
    log.info(`Unloaded plugin: ${name}`);
    return true;
  }

  formatPluginList(): string {
    const plugins = this.listPlugins();
    if (plugins.length === 0) return "No plugins installed.";

    return plugins
      .map((p) => {
        const status = p.enabled ? "🟢" : "🔴";
        const tools = p.metadata.tools?.length || 0;
        const commands = p.metadata.commands?.length || 0;
        return `${status} **${p.metadata.name}** v${p.metadata.version}\n   ${p.metadata.description}\n   Tools: ${tools} | Commands: ${commands}`;
      })
      .join("\n\n");
  }
}

export async function createPluginRegistry(
  workspaceDir: string,
): Promise<PluginRegistry> {
  const pluginDir = path.join(workspaceDir, ".jim", "plugins");
  const registry = new PluginRegistry(pluginDir);
  await registry.init();
  return registry;
}
