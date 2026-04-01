import { cwd } from "node:process";

/**
 * Get the current working directory
 * Primarily used in CLI context
 */
export function getCwd(): string {
  return cwd();
}
