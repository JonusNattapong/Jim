import { resolve, normalize, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { childLogger } from "../utils/logger.js";

export interface TrustedFolderConfig {
  /** List of trusted directory paths (glob patterns supported) */
  paths: string[];
  /** If true, only allow operations within trusted paths */
  enforce: boolean;
}

/**
 * Trusted folders policy — controls which directories the agent can operate in.
 *
 * Config file: .jim/trusted-folders.json
 * Example:
 * {
 *   "paths": ["/home/user/projects/*", "/tmp/jim-workspace"],
 *   "enforce": true
 * }
 */
export class TrustedFolderPolicy {
  private trustedPaths: string[] = [];
  private enforce: boolean = false;
  private log = childLogger({ component: "trusted-folders" });

  async load(configPath?: string, projectRoot?: string): Promise<void> {
    const path = configPath ?? (projectRoot ? resolve(projectRoot, ".jim", "trusted-folders.json") : ".jim/trusted-folders.json");
    try {
      const content = await readFile(resolve(path), "utf-8");
      const config = JSON.parse(content) as TrustedFolderConfig;
      this.trustedPaths = config.paths ?? [];
      this.enforce = config.enforce ?? false;
      this.log.info({ paths: this.trustedPaths.length, enforce: this.enforce }, "trusted folders loaded");
    } catch {
      // No config — no enforcement
    }
  }

  /** Check if a path is within any trusted folder */
  isTrusted(targetPath: string): boolean {
    if (!this.enforce || this.trustedPaths.length === 0) return true;

    const normalized = normalize(resolve(targetPath));

    for (const trusted of this.trustedPaths) {
      if (this.matchPath(normalized, resolve(trusted))) {
        return true;
      }
    }

    return false;
  }

  /** Check if an operation on a path should be allowed */
  check(targetPath: string): { allowed: boolean; reason?: string } {
    if (this.isTrusted(targetPath)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Path '${targetPath}' is outside trusted folders. Add it to .jim/trusted-folders.json to allow.`,
    };
  }

  /** Add a path to trusted list */
  addPath(path: string): void {
    if (!this.trustedPaths.includes(path)) {
      this.trustedPaths.push(path);
    }
  }

  /** Remove a path from trusted list */
  removePath(path: string): void {
    this.trustedPaths = this.trustedPaths.filter((p) => p !== path);
  }

  /** Enable/disable enforcement */
  setEnforce(enforce: boolean): void {
    this.enforce = enforce;
  }

  /** Get current config */
  getConfig(): TrustedFolderConfig {
    return { paths: [...this.trustedPaths], enforce: this.enforce };
  }

  /** Match a normalized path against a trusted pattern */
  private matchPath(normalizedPath: string, trustedPattern: string): boolean {
    // Simple glob: * matches any segment
    if (trustedPattern.includes("*")) {
      const regex = new RegExp(
        "^" + trustedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "(/.*)?$"
      );
      return regex.test(normalizedPath);
    }

    // Exact or parent match
    const rel = relative(trustedPattern, normalizedPath);
    return !rel.startsWith("..") && !isAbsolute(rel);
  }
}

function isAbsolute(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:/.test(p);
}
