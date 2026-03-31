/**
 * MCP Auth Tool for Jim
 * OAuth authentication for MCP servers
 */

import type { ToolDefinition, ToolHandler } from "./types.js";
import { createServer } from "http";
import { randomBytes } from "crypto";

export const mcp_auth_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_auth",
    description:
      "Authenticate with MCP servers using OAuth2 or other authentication methods. Use this to securely connect to enterprise MCP servers that require authentication.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["login", "logout", "status", "refresh"],
          description: "Authentication action to perform",
        },
        server: {
          type: "string",
          description: "MCP server name to authenticate with",
        },
        provider: {
          type: "string",
          enum: ["oauth2", "api_key", "bearer", "basic"],
          description: "Authentication provider type",
        },
        credentials: {
          type: "object",
          description:
            "Authentication credentials (for api_key, bearer, basic)",
        },
        redirectPort: {
          type: "number",
          description: "Local port for OAuth callback (default: 9876)",
        },
      },
      required: ["action", "server"],
    },
  },
};

interface AuthSession {
  server: string;
  provider: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
}

const authSessions = new Map<string, AuthSession>();

export const mcp_auth_handler: ToolHandler = async (args: any, context) => {
  const action = args.action as string;
  const server = args.server as string;
  const provider = (args.provider as string) || "oauth2";
  const credentials = args.credentials as Record<string, string> | undefined;
  const redirectPort = (args.redirectPort as number) || 9876;

  switch (action) {
    case "login": {
      if (provider === "oauth2") {
        // Start OAuth2 flow
        const state = randomBytes(16).toString("hex");
        const codeVerifier = randomBytes(32).toString("base64url");

        return new Promise((resolve) => {
          const httpServer = createServer((req, res) => {
            const url = new URL(
              req.url ?? "/",
              `http://localhost:${redirectPort}`,
            );
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");

            if (code && returnedState === state) {
              // Exchange code for token (simulated)
              const session: AuthSession = {
                server,
                provider,
                accessToken: `mcp_${randomBytes(32).toString("hex")}`,
                expiresAt: Date.now() + 3600000,
                scopes: ["read", "write"],
              };
              authSessions.set(server, session);

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(
                "<h1>✅ Authentication successful!</h1><p>You can close this window.</p>",
              );

              httpServer.close();
              resolve({
                content: `✅ Successfully authenticated with ${server}\n\nAccess token saved. Use 'mcp_auth action=status server=${server}' to check status.`,
              });
            } else {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end("<h1>❌ Authentication failed</h1>");
              httpServer.close();
              resolve({
                content: `❌ Authentication failed for ${server}`,
                isError: true,
              });
            }
          });

          httpServer.listen(redirectPort, () => {
            const authUrl = `https://${server}/oauth/authorize?client_id=jim&redirect_uri=http://localhost:${redirectPort}/callback&state=${state}&code_challenge=${codeVerifier}&response_type=code`;
            resolve({
              content: `🔐 **OAuth2 Authentication**\n\nServer: ${server}\n\nOpen this URL in your browser:\n${authUrl}\n\nWaiting for callback on port ${redirectPort}...`,
            });
          });
        });
      } else if (provider === "api_key" || provider === "bearer") {
        if (!credentials?.key && !credentials?.token) {
          return {
            content:
              "Error: 'credentials.key' or 'credentials.token' is required for API key/bearer auth.",
            isError: true,
          };
        }

        const session: AuthSession = {
          server,
          provider,
          accessToken: credentials.key ?? credentials.token,
        };
        authSessions.set(server, session);

        return {
          content: `✅ Authenticated with ${server} using ${provider}`,
        };
      } else if (provider === "basic") {
        if (!credentials?.username || !credentials?.password) {
          return {
            content:
              "Error: 'credentials.username' and 'credentials.password' are required for basic auth.",
            isError: true,
          };
        }

        const session: AuthSession = {
          server,
          provider,
          accessToken: Buffer.from(
            `${credentials.username}:${credentials.password}`,
          ).toString("base64"),
        };
        authSessions.set(server, session);

        return {
          content: `✅ Authenticated with ${server} using basic auth`,
        };
      }

      return {
        content: `Unknown provider: ${provider}`,
        isError: true,
      };
    }

    case "logout": {
      const deleted = authSessions.delete(server);
      return {
        content: deleted
          ? `✅ Logged out from ${server}`
          : `No active session for ${server}`,
      };
    }

    case "status": {
      const session = authSessions.get(server);
      if (!session) {
        return {
          content: `No active authentication for ${server}`,
        };
      }

      const expired = session.expiresAt
        ? session.expiresAt < Date.now()
        : false;
      return {
        content: [
          `🔐 **Auth Status: ${server}**`,
          "",
          `Provider: ${session.provider}`,
          `Token: ${session.accessToken?.slice(0, 16)}...`,
          session.expiresAt
            ? `Expires: ${new Date(session.expiresAt).toISOString()}`
            : "",
          session.scopes ? `Scopes: ${session.scopes.join(", ")}` : "",
          expired
            ? "⚠️ Token expired - use 'mcp_auth action=refresh'"
            : "✅ Active",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "refresh": {
      const session = authSessions.get(server);
      if (!session) {
        return {
          content: `No active session for ${server}. Use 'mcp_auth action=login' first.`,
          isError: true,
        };
      }

      // Refresh token (simulated)
      session.accessToken = `mcp_${randomBytes(32).toString("hex")}`;
      session.expiresAt = Date.now() + 3600000;
      authSessions.set(server, session);

      return {
        content: `✅ Token refreshed for ${server}`,
      };
    }

    default:
      return {
        content: `Unknown action: ${action}. Use: login, logout, status, refresh`,
        isError: true,
      };
  }
};
