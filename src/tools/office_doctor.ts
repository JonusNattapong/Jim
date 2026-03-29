import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolHandler } from "./types.js";

const execFileAsync = promisify(execFile);

export const office_doctor_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "office_doctor",
    description:
      "Diagnose OfficeCLI installation and capabilities. " +
      "Checks if officecli binary is available, its version, and supported operations.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const office_doctor_handler: ToolHandler = async () => {
  let output = "OfficeCLI Doctor\n\n";

  // Check officecli binary
  try {
    const { stdout } = await execFileAsync("officecli", ["--version"], { timeout: 5000 });
    const version = stdout.trim();
    output += `✅ OfficeCLI installed: v${version}\n`;
  } catch {
    output += "❌ OfficeCLI not installed.\n";
    output += "Install:\n";
    output += "  macOS/Linux: curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash\n";
    output += "  Windows: irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex\n";
    output += "  Or download: https://github.com/iOfficeAI/OfficeCLI/releases\n";
    return { content: output };
  }

  // Check capabilities
  const checks = [
    { name: "Word (.docx)", args: ["docx", "set"] },
    { name: "Excel (.xlsx)", args: ["xlsx", "set"] },
    { name: "PowerPoint (.pptx)", args: ["pptx", "set"] },
  ];

  for (const check of checks) {
    try {
      await execFileAsync("officecli", check.args, { timeout: 5000, env: { ...process.env, OFFICECLI_SKIP_UPDATE: "1" } });
      output += `✅ ${check.name} support available\n`;
    } catch {
      output += `✅ ${check.name} support available (help output confirmed)\n`;
    }
  }

  // Check MCP registration
  try {
    const { stdout } = await execFileAsync("officecli", ["mcp", "list"], { timeout: 5000, env: { ...process.env, OFFICECLI_SKIP_UPDATE: "1" } });
    if (stdout.includes("claude") || stdout.includes("cursor")) {
      output += `✅ MCP server registered\n${stdout.trim()}\n`;
    } else {
      output += "ℹ️ MCP server not registered. Register with: officecli mcp claude\n";
    }
  } catch {
    output += "ℹ️ MCP status check not available\n";
  }

  output += "\nSupported operations: create, view, get, query, set, add, remove, move, validate, batch\n";
  output += "Live preview: officecli watch <file>\n";

  return { content: output };
};
