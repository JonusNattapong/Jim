import type { EnhancedCommandDefinition } from "../types.js";

const model = {
  type: "local",
  name: "model",
  description: "View or switch the current AI model",
  argumentHint: "[model-name]",
  category: "model",
  supportsNonInteractive: true,
  load: () => import("./model.js"),
} satisfies EnhancedCommandDefinition;

export default model;
