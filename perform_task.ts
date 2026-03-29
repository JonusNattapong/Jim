import "dotenv/config";
import { Agent } from "./src/agent/loop.js";
import { loadSavedProviderSelection, loadProviderSettings } from "./src/config/provider-store.js";
import { resolveProviderPreset, type ResolvedProviderPreset } from "./src/config/provider-presets.js";

async function runTask() {
  console.log("🚀 Starting Jim Task Engine...");
  
  const projectRoot = process.cwd();
  
  // 1. Resolve which provider and credentials to use
  const modelOverride = process.env.OPENAI_MODEL || "minimax/minimax-m2.5:free";
  let presetId = process.env.PROVIDER_PRESET ?? loadSavedProviderSelection(projectRoot) ?? "openai";
  
  // Smart redirect: if using minimax or kilocode models, prefer the kilocode/minimax preset if available
  if (modelOverride.startsWith("minimax/") || modelOverride.startsWith("kilocode/")) {
    // Try kilocode preset first
    const kiloPreset = resolveProviderPreset("kilocode", process.env, loadProviderSettings(projectRoot, "kilocode"));
    if (kiloPreset?.configured) {
      presetId = "kilocode";
    } else {
      // Fallback to minimax preset
      const minimaxPreset = resolveProviderPreset("minimax", process.env, loadProviderSettings(projectRoot, "minimax"));
      if (minimaxPreset?.configured) {
        presetId = "minimax";
      }
    }
  }

  let resolvedPreset = resolveProviderPreset(presetId, process.env, loadProviderSettings(projectRoot, presetId));

  // If preset is not configured but we have a model-specific prefix,
  // try to infer from environment or fall back to openai preset with env vars
  if ((!resolvedPreset || !resolvedPreset.configured) && modelOverride.includes("/")) {
    const openaiPreset = resolveProviderPreset("openai", process.env, loadProviderSettings(projectRoot, "openai"));
    if (openaiPreset?.configured) {
      console.log(`⚠️ ${presetId} preset not saved, using openai preset with environment variables...`);
      resolvedPreset = openaiPreset;
      presetId = "openai";
    }
  }

  if (!resolvedPreset || !resolvedPreset.configured) {
    // Fallback: if we were trying kilocode/minimax and it failed, but we have openai configured, use that
    if (presetId === "kilocode" || presetId === "minimax") {
      const openaiPreset = resolveProviderPreset("openai", process.env, loadProviderSettings(projectRoot, "openai"));
      if (openaiPreset?.configured) {
        console.log(`⚠️ ${presetId} preset not configured, falling back to OpenAI preset (using Kilo Gateway via .env)...`);
        runWithPreset(openaiPreset, "openai");
        return;
      }
    }

    console.error(`❌ Error: Provider preset ${presetId} is not configured correctly for this task.`);
    console.log(`💡 Tip: Run '/connect ${presetId}' in Jim UI first to save your credentials.`);
    process.exit(1);
  }

  await runWithPreset(resolvedPreset, presetId);
}

async function runWithPreset(resolvedPreset: ResolvedProviderPreset, presetId: string) {
  const projectRoot = process.cwd();

  // Set up env for the agent
  if (resolvedPreset.envAssignments) {
    for (const [key, value] of Object.entries(resolvedPreset.envAssignments)) {
      process.env[key] = value;
    }
  }

  // Use environment variables as fallback for base URL and API key
  // This ensures Kilo Gateway values from .env are used when presets aren't configured
  const baseUrl = resolvedPreset.resolvedBaseUrl
    || process.env.OPENAI_BASE_URL
    || process.env.KILOCODE_BASE_URL
    || "https://api.openai.com/v1";
  const apiKey = resolvedPreset.apiKey
    || process.env.OPENAI_API_KEY
    || process.env.KILOCODE_API_KEY
    || "";

  const agent = new Agent({
    apiKey,
    baseUrl,
    model: process.env.OPENAI_MODEL || resolvedPreset.values["model"] || "minimax/minimax-m2.5:free",
    maxTurns: 5,
    maxToolOutput: 5000,
    projectRoot: projectRoot,
    permissionMode: "dontAsk",
    streaming: false
  });

  await agent.init();
  
  console.log(`🤖 Jim is ready! Model: ${agent.getModel()} | Provider: ${presetId}`);
  console.log("📝 Task: Create a file named 'WOW.md' with a premium greeting.");

  const response = await agent.run("Create a file named WOW.md with a cool greeting message for my friend Admin.", {
    onThinking: (t) => console.log(`💭 Thinking: ${t}`),
    onToolCall: (name, args) => console.log(`🛠️ Tool Call: ${name}(${JSON.stringify(args)})`),
    onToolResult: (name, res) => console.log(`✅ Tool Result: ${name} -> Success!`)
  });

  console.log("\n--- Final Response ---");
  console.log(response);
  console.log("----------------------");
}

runTask().catch(err => {
  console.error("❌ Fatal Error:", err.message);
  process.exit(1);
});
