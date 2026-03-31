/**
 * Plugin System - Extensibility Framework
 * 
 * Inspired by Claude Code's plugin system that allows community
 * extensions with manifest validation, hooks, and lifecycle management.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Plugin manifest structure
 */
export interface PluginManifest {
  /** Plugin unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Version (semver) */
  version: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** Entry point file */
  main: string;
  /** Plugin hooks */
  hooks?: PluginHookConfig[];
  /** Plugin commands */
  commands?: PluginCommandConfig[];
  /** Dependencies */
  dependencies?: string[];
  /** Jim version compatibility */
  jimVersion?: string;
}

/**
 * Plugin hook configuration
 */
export interface PluginHookConfig {
  event: string;
  handler: string;
  priority?: number;
}

/**
 * Plugin command configuration
 */
export interface PluginCommandConfig {
  name: string;
  description: string;
  handler: string;
  aliases?: string[];
}

/**
 * Plugin instance
 */
export interface Plugin {
  manifest: PluginManifest;
  directory: string;
  loadedAt: number;
  enabled: boolean;
  exports?: PluginExports;
}

/**
 * Plugin exports
 */
export interface PluginExports {
  activate?: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
  commands?: Record<string, (args: string[]) => Promise<void>>;
  hooks?: Record<string, (context: unknown) => Promise<void>>;
}

/**
 * Plugin context provided to plugins
 */
export interface PluginContext {
  /** Plugin directory */
  pluginDir: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Register a command */
  registerCommand: (
    name: string,
    handler: (args: string[]) => Promise<void>
  ) => void;
  /** Register a hook */
  registerHook: (
    event: string,
    handler: (context: unknown) => Promise<void>
  ) => void;
  /** Log a message */
  log: (message: string) => void;
}

/**
 * Plugin error
 */
export interface PluginError {
  plugin: string;
  directory?: string;
  error: string;
  severity: "error" | "warning";
}

// ============================================================================
// Plugin Manager
// ============================================================================

/**
 * Manages plugin loading, lifecycle, and execution
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private errors: PluginError[] = [];
  private searchPaths: string[] = [];

  constructor(searchPaths: string[] = []) {
    this.searchPaths = searchPaths;
  }

  /**
   * Add a plugin search path
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
    }
  }

  /**
   * Load a plugin from directory
   */
  async loadPlugin(pluginDir: string): Promise<Plugin | null> {
    try {
      // Read manifest
      const manifestPath = `${pluginDir}/plugin.json`;
      const manifest = await this.readManifest(manifestPath);

      if (!manifest) {
        this.errors.push({
          plugin: pluginDir,
          directory: pluginDir,
          error: "No plugin.json found",
          severity: "error",
        });
        return null;
      }

      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        this.errors.push({
          plugin: manifest.id,
          directory: pluginDir,
          error: validation.error ?? "Invalid manifest",
          severity: "error",
        });
        return null;
      }

      // Check if already loaded
      if (this.plugins.has(manifest.id)) {
        this.errors.push({
          plugin: manifest.id,
          directory: pluginDir,
          error: "Plugin already loaded",
          severity: "warning",
        });
        return this.plugins.get(manifest.id) ?? null;
      }

      // Create plugin instance
      const plugin: Plugin = {
        manifest,
        directory: pluginDir,
        loadedAt: Date.now(),
        enabled: true,
      };

      this.plugins.set(manifest.id, plugin);
      return plugin;
    } catch (error) {
      this.errors.push({
        plugin: pluginDir,
        directory: pluginDir,
        error: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
      return null;
    }
  }

  /**
   * Read and parse manifest
   */
  private async readManifest(path: string): Promise<PluginManifest | null> {
    try {
      // In production, this would use fs.readFile
      // For now, return a mock
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate plugin manifest
   */
  validateManifest(manifest: unknown): { valid: boolean; error?: string } {
    if (!manifest || typeof manifest !== "object") {
      return { valid: false, error: "Manifest must be an object" };
    }

    const m = manifest as Record<string, unknown>;

    if (!m.id || typeof m.id !== "string") {
      return { valid: false, error: "Missing or invalid 'id' field" };
    }

    if (!m.name || typeof m.name !== "string") {
      return { valid: false, error: "Missing or invalid 'name' field" };
    }

    if (!m.version || typeof m.version !== "string") {
      return { valid: false, error: "Missing or invalid 'version' field" };
    }

    if (!m.main || typeof m.main !== "string") {
      return { valid: false, error: "Missing or invalid 'main' field" };
    }

    return { valid: true };
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      if (plugin.exports?.activate) {
        const context = this.createPluginContext(plugin);
        await plugin.exports.activate(context);
      }
      plugin.enabled = true;
      return true;
    } catch (error) {
      this.errors.push({
        plugin: pluginId,
        error: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
      return false;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      if (plugin.exports?.deactivate) {
        await plugin.exports.deactivate();
      }
      plugin.enabled = false;
      return true;
    } catch (error) {
      this.errors.push({
        plugin: pluginId,
        error: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
      return false;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    await this.deactivatePlugin(pluginId);
    this.plugins.delete(pluginId);
    return true;
  }

  /**
   * Create plugin context
   */
  private createPluginContext(plugin: Plugin): PluginContext {
    return {
      pluginDir: plugin.directory,
      manifest: plugin.manifest,
      registerCommand: (name, handler) => {
        if (!plugin.exports) plugin.exports = {};
        if (!plugin.exports.commands) plugin.exports.commands = {};
        plugin.exports.commands[name] = handler;
      },
      registerHook: (event, handler) => {
        if (!plugin.exports) plugin.exports = {};
        if (!plugin.exports.hooks) plugin.exports.hooks = {};
        plugin.exports.hooks[event] = handler;
      },
      log: (message) => {
        console.log(`[${plugin.manifest.id}] ${message}`);
      },
    };
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): Plugin[] {
    return this.getAllPlugins().filter((p) => p.enabled);
  }

  /**
   * Get plugin errors
   */
  getErrors(): PluginError[] {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    errors: number;
    warnings: number;
  } {
    const plugins = this.getAllPlugins();
    return {
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter((p) => p.enabled).length,
      errors: this.errors.filter((e) => e.severity === "error").length,
      warnings: this.errors.filter((e) => e.severity === "warning").length,
    };
  }
}

// ============================================================================
// Built-in Plugin: Example
// ============================================================================

/**
 * Example plugin manifest
 */
export const EXAMPLE_PLUGIN_MANIFEST: PluginManifest = {
  id: "example-plugin",
  name: "Example Plugin",
  version: "1.0.0",
  description: "An example plugin demonstrating the plugin system",
  author: "Jim Team",
  main: "index.js",
  commands: [
    {
      name: "hello",
      description: "Say hello from the plugin",
      handler: "commands/hello.js",
      aliases: ["hi"],
    },
  ],
  hooks: [
    {
      event: "SessionStart",
      handler: "hooks/session-start.js",
      priority: 10,
    },
  ],
};

// ============================================================================
// Exports
// ============================================================================

export const Plugins = {
  PluginManager,
  EXAMPLE_PLUGIN_MANIFEST,
} as const;