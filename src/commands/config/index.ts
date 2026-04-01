import type { EnhancedCommandDefinition } from "../types.js";

const config = {
  type: "local",
  name: "config",
  description: "View or modify configuration settings",
  argumentHint: "[key] [value]",
  category: "config",
  supportsNonInteractive: false,
  load: () => import("./config.js"),
} satisfies EnhancedCommandDefinition;

export default config;
