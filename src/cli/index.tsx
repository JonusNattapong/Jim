#!/usr/bin/env node
import "dotenv/config";
import React from "react";
import gradient from "gradient-string";
import { Agent } from "../agent/index.js";
import type { AgentConfig } from "../agent/index.js";
import type { PermissionMode } from "../permissions/manager.js";
import { App } from "./app.js";
import { getRandomTag } from "./taglines.js";
import { loadProviderSettings, loadSavedProviderSelection } from "../config/provider-store.js";
import { resolveProviderPreset } from "../config/provider-presets.js";
import { shutdownLogger } from "../utils/logger.js";

// ─── Config ────────────────────────────────────────────

function loadConfig(): AgentConfig {
  const projectRoot = process.cwd();
  const presetId = process.env.PROVIDER_PRESET ?? loadSavedProviderSelection(projectRoot) ?? "openai";
  const resolvedPreset = resolveProviderPreset(presetId, process.env, loadProviderSettings(projectRoot, presetId));
  if (resolvedPreset) {
    for (const [key, value] of Object.entries(resolvedPreset.envAssignments)) {
      process.env[key] = value;
    }
  }
  const apiKey = resolvedPreset?.apiKey || process.env.OPENAI_API_KEY;
  const apiMode = process.env.API_MODE;
  if (!apiKey) {
    console.error("Error: no provider credentials found.\n  export OPENAI_API_KEY=sk-...\n  or set PROVIDER_PRESET plus the matching API key env.");
    process.exit(1);
  }
  return {
    apiKey,
    baseUrl: resolvedPreset?.resolvedBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    maxTurns: parseInt(process.env.MAX_TURNS ?? "25", 10),
    maxToolOutput: parseInt(process.env.MAX_TOOL_OUTPUT ?? "5000", 10),
    projectRoot,
    permissionMode: (process.env.PERMISSION_MODE as PermissionMode) ?? "default",
    streaming: false,
    api: apiMode === "responses" || apiMode === "chat-completions" || apiMode === "openai" || apiMode === "openai-compatible" || apiMode === "auto"
      ? apiMode
      : resolvedPreset?.adapter ?? "auto",
    providerPreset: presetId,
  };
}

async function closeAgent(agent: Agent): Promise<void> {
  await agent.close();
  await shutdownLogger();
}

// ─── Main ──────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();
  const agent = new Agent(config);
  const logo = `
      ██╗██╗███╗   ███╗
      ██║██║████╗ ████║
      ██║██║██╔████╔██║
 ██   ██║██║██║╚██╔╝██║
  ╚█████╔╝██║██║ ╚═╝ ██║
  ╚════╝ ╚═╝╚═╝     ╚═╝
  `;

  if (process.argv.includes("--smoke-exit")) {
    await closeAgent(agent);
    console.log("smoke:ok");
    process.exit(0);
  }

  // Initialize agent (load memory, hooks, MCP)
  await agent.init({
    onMemoryLoaded(count) {
      if (count > 0) console.log(`  Loaded ${count} memory layers`);
    },
  });

  // DEBUG: console.log("CLI ARGS:", process.argv);

  // Handle session loading from CLI args
  let sessionIdToLoad: string | undefined;
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "-s" || arg === "--session") {
      sessionIdToLoad = process.argv[i + 1];
      break;
    }
    // Smart detection: any arg starting with "session-"
    if (arg.startsWith("session-")) {
      sessionIdToLoad = arg;
      break;
    }
  }

  if (sessionIdToLoad) {
    const loaded = await agent.loadSession(sessionIdToLoad);
    if (loaded) {
      console.log(`\n  \x1b[32m✔\x1b[0m Restored session: ${sessionIdToLoad}`);
    } else {
      console.log(`\n  \x1b[31m✖\x1b[0m Failed to restore session: ${sessionIdToLoad}`);
    }
  }

  let closing = false;
  const handleShutdown = (code = 0) => {
    if (closing) return;
    closing = true;
    void closeAgent(agent).finally(() => process.exit(code));
  };
  process.once("SIGINT", () => handleShutdown(0));
  process.once("SIGTERM", () => handleShutdown(0));

  const sessionId = agent.getSessionId() || "new_session_" + Date.now().toString(36).slice(-6);
  
  // Render Ink app
  const { render } = await import("ink");
  const { waitUntilExit } = render(
    <App
      agent={agent}
      initialModel={config.model}
      initialMode={config.permissionMode ?? "default"}
      initialStreaming={false}
    />
  );

  await waitUntilExit();
  await closeAgent(agent);
  
  // ASCII Banner on exit
  console.log(gradient.cristal.multiline(logo));
  console.log(`  \x1b[3m\x1b[90m${getRandomTag()}\x1b[0m\n`);
  
  // Session Info
  const finalSessionId = agent.getSessionId() || sessionId;
  console.log(`  \x1b[90mSession\x1b[0m   \x1b[1mJim AI Coding Agent \x1b[36m${config.model}\x1b[0m`);
  console.log(`  \x1b[90mContinue\x1b[0m  \x1b[1mjim -s ${finalSessionId}\x1b[0m\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal: ${err}`);
  process.exit(1);
});
