import type {
  EnhancedCommandDefinition,
  LocalCommandCall,
} from "../types.js";

/**
 * Bridge command group for remote control
 * Patterns: lazy-loading, context-aware actions
 */
export const bridge_command_definition: EnhancedCommandDefinition = {
  name: "bridge",
  category: "local",
  type: "local",
  description: "Manage remote bridge server for mobile/web access",
  argumentHint: "[start|stop|status|config]",
  load: async () => {
    const { handleBridgeCommand } = await import("./bridge.js");
    return {
      call: async (args: LocalCommandCall) => {
        return handleBridgeCommand(args);
      },
    };
  },
};
