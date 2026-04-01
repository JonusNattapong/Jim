import type { EnhancedCommandDefinition } from "../types.js";
import { health_handler } from "./health.js";

export const health_command: EnhancedCommandDefinition = {
  type: "local",
  name: "health",
  help: "Run project health diagnostics",
  description:
    "Checks your workspace configuration, environment variables, and dependencies. Helps diagnose setup issues and suggests fixes for problems found.",
  argumentHint: "[--verbose]",
  category: "system",
  handler: health_handler,
};
