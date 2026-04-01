import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";

/**
 * Migration System for handling schema changes
 * Adapted from Claude Code's migration pattern
 */

export interface Migration {
  version: string;
  description: string;
  migrate: (data: unknown) => unknown;
}

export interface VersionedData {
  _version: string;
  [key: string]: any;
}

export class MigrationManager {
  private migrations: Map<string, Migration> = new Map();

  /**
   * Register a migration for a specific version
   */
  register(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  /**
   * Get all registered migrations sorted by version
   */
  getMigrations(): Migration[] {
    return Array.from(this.migrations.values()).sort((a, b) =>
      a.version.localeCompare(b.version)
    );
  }

  /**
   * Apply migrations from source version to target version
   */
  apply(data: VersionedData, targetVersion: string): VersionedData {
    const migrations = this.getMigrations();
    const sourceVersion = data._version || "0.0.0";

    let current = { ...data };
    let applied = false;

    for (const migration of migrations) {
      if (
        migration.version > sourceVersion &&
        migration.version <= targetVersion
      ) {
        try {
          current = migration.migrate(current);
          current._version = migration.version;
          applied = true;
          console.log(
            `✓ Applied migration to ${migration.version}: ${migration.description}`
          );
        } catch (err) {
          console.error(`✗ Migration to ${migration.version} failed:`, err);
          throw err;
        }
      }
    }

    if (!applied) {
      console.log(`No migrations needed (current: ${sourceVersion})`);
    }

    return current;
  }

  /**
   * Load, migrate, and validate data from a file
   */
  async loadAndMigrate<T>(
    filePath: string,
    targetVersion: string,
    validator?: z.ZodSchema
  ): Promise<T> {
    try {
      const content = await readFile(filePath, "utf-8");
      let data = JSON.parse(content);

      // Apply migrations if needed
      if (data._version && data._version !== targetVersion) {
        data = this.apply(data as VersionedData, targetVersion);
      }

      // Validate against schema if provided
      if (validator) {
        data = validator.parse(data);
      }

      return data;
    } catch (err) {
      console.error(`Failed to load and migrate ${filePath}:`, err);
      throw err;
    }
  }

  /**
   * Save versioned data to file
   */
  async saveVersioned(
    filePath: string,
    data: unknown,
    version: string
  ): Promise<void> {
    const versionedData: VersionedData = {
      _version: version,
      ...(typeof data === "object" && data !== null ? data : {}),
    };

    await writeFile(filePath, JSON.stringify(versionedData, null, 2));
  }
}

/**
 * Common migrations for Jim
 */

export const jimMigrations = {
  addSessionVersion: {
    version: "0.1.0",
    description: "Add version tracking to sessions",
    migrate: (data: any) => ({
      ...data,
      _version: "0.1.0",
      createdAt: data.createdAt || new Date().toISOString(),
    }),
  },

  addCostTracking: {
    version: "0.2.0",
    description: "Add cost tracking to session metadata",
    migrate: (data: any) => ({
      ...data,
      _version: "0.2.0",
      costTracking: data.costTracking || {
        totalCost: 0,
        tokenCount: 0,
      },
    }),
  },

  normalizeModelNames: {
    version: "0.3.0",
    description: "Normalize model names to follow new naming convention",
    migrate: (data: any) => {
      const modelMap: Record<string, string> = {
        "gpt-4": "gpt-4o",
        "gpt-3.5": "gpt-3.5-turbo",
        "claude-2": "claude-3-opus",
      };

      if (data.model && modelMap[data.model]) {
        console.log(`Updating model: ${data.model} -> ${modelMap[data.model]}`);
        data.model = modelMap[data.model];
      }

      return {
        ...data,
        _version: "0.3.0",
      };
    },
  },

  addPermissionFlags: {
    version: "0.4.0",
    description: "Add permission mode flags to config",
    migrate: (data: any) => ({
      ...data,
      _version: "0.4.0",
      permissions: data.permissions || {
        mode: "ask",
        trustedFolders: [],
      },
    }),
  },
};

// Global migration manager
let globalMigrationManager: MigrationManager | null = null;

export function getMigrationManager(): MigrationManager {
  if (!globalMigrationManager) {
    globalMigrationManager = new MigrationManager();
    // Register default migrations
    Object.values(jimMigrations).forEach((m) =>
      globalMigrationManager!.register(m)
    );
  }
  return globalMigrationManager;
}

export const CURRENT_VERSION = "0.4.0";
