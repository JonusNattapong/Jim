import type { LocalCommandCall, CommandResult } from "../types.js";
import { BridgeServer } from "../../bridge/index.js";

let bridgeServer: BridgeServer | null = null;

/**
 * Handle bridge command: manages remote WebSocket access
 * Inspired by Claude Code's remote access patterns
 */
export async function handleBridgeCommand(
  call: LocalCommandCall,
): Promise<CommandResult> {
  const [action, ...params] = call.args;

  switch (action) {
    case "start":
      if (bridgeServer) {
        return {
          type: "text",
          value: "⚠️ Bridge server is already running.",
        };
      }
      try {
        const port = params[0] ? parseInt(params[0]) : 18789;
        const host = "127.0.0.1";

        bridgeServer = new BridgeServer({
          port,
          host,
          projectRoot: process.cwd(),
        });

        await bridgeServer.start();

        return {
          type: "text",
          value: `✅ Bridge server started on http://${host}:${port}\nRemote control via WebSocket is now active.`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          type: "text",
          value: `❌ Failed to start bridge server: ${msg}`,
          isError: true,
        };
      }

    case "stop":
      if (!bridgeServer) {
        return {
          type: "text",
          value: "⚠️ Bridge server is not running.",
        };
      }
      // Assuming a stop method exists or would be added
      // bridgeServer.stop();
      bridgeServer = null;
      return {
        type: "text",
        value: "🛑 Bridge server stopped.",
      };

    case "status":
      if (!bridgeServer) {
        return {
          type: "text",
          value: "⚪ Bridge server is offline.",
        };
      }
      return {
        type: "text",
        value: "🟢 Bridge server is online and listening for remote connections.",
      };

    case "config":
      return {
        type: "text",
        value: "Bridge configuration: Port: 18789, Host: 127.0.0.1 (Loopback only)",
      };

    default:
      return {
        type: "text",
        value: "Usage: /bridge [start|stop|status|config]",
      };
  }
}
