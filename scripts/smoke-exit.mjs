import { spawn } from "node:child_process";

const child = spawn("node", ["dist/cli/index.js", "--smoke-exit"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    JIM_SKIP_MCP: "1",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "local-smoke-key",
    PROVIDER_PRESET: process.env.PROVIDER_PRESET || "openai",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const timeout = setTimeout(() => {
  child.kill("SIGTERM");
}, 10000);

const code = await new Promise((resolve) => {
  child.on("exit", resolve);
});

clearTimeout(timeout);

if (code !== 0) {
  console.error(stderr || stdout || `smoke exit failed with code ${code}`);
  process.exit(Number(code) || 1);
}

if (!stdout.includes("smoke:ok")) {
  console.error(`unexpected smoke output:\n${stdout}${stderr}`);
  process.exit(1);
}

console.log("smoke exit passed");
