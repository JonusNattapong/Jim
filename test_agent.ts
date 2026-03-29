import { Agent } from "./src/agent/loop.js";
import { PermissionManager } from "./src/permissions/manager.js";
import "dotenv/config";

async function test() {
  const agent = new Agent({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "",
    model: "minimax-m2.5:free",
    projectRoot: process.cwd(),
    permissionMode: "auto",
    maxToolOutput: 5000,
    maxTurns: 5,
    streaming: false
  });

  await agent.init({
    onToolCall(name, args) {
      console.log(`[Tool Call]: ${name}`);
    },
    onToolResult(name, result, isError) {
      console.log(`[Tool Result]: ${isError ? "Error" : "Success"} (${result.length} chars)`);
    }
  });

  const reply = await agent.run("Please run get_repo_map on src/tools with includeImports true");
  console.log("\\n[Agent Reply]:\\n" + reply);
}

test().catch(console.error);
