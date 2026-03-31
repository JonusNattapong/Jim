/**
 * PowerShell Tool for Jim
 * Execute PowerShell commands on Windows systems
 */

import type { ToolDefinition, ToolHandler } from "./types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const powershell_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "powershell",
    description:
      "Execute PowerShell commands on Windows. Use this for Windows-specific tasks like registry access, WMI queries, Windows services management, and PowerShell scripting.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The PowerShell command to execute",
        },
        workingDirectory: {
          type: "string",
          description: "Working directory for the command (optional)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 30000)",
        },
      },
      required: ["command"],
    },
  },
};

export const powershell_handler: ToolHandler = async (args: any, context) => {
  if (process.platform !== "win32") {
    return {
      content: "PowerShell tool is only available on Windows systems.",
      isError: true,
    };
  }

  const command = args.command as string;
  const workingDirectory = args.workingDirectory as string | undefined;
  const timeout = (args.timeout as number) || 30000;

  if (!command) {
    return {
      content: "Error: 'command' is required.",
      isError: true,
    };
  }

  try {
    const options: any = {
      timeout,
      maxBuffer: 1024 * 1024,
      encoding: "utf-8",
    };

    if (workingDirectory) {
      options.cwd = workingDirectory;
    }

    // Use PowerShell Core (pwsh) if available, fallback to Windows PowerShell
    let psCommand: string;
    try {
      await execAsync("where pwsh");
      psCommand = `pwsh -Command "${command.replace(/"/g, '\\"')}"`;
    } catch {
      psCommand = `powershell -Command "${command.replace(/"/g, '\\"')}"`;
    }

    const { stdout, stderr } = await execAsync(psCommand, options);

    let output = "";
    if (stdout) output += stdout;
    if (stderr) output += `\n[STDERR]\n${stderr}`;

    return {
      content: output || "Command executed successfully (no output)",
      isError: false,
    };
  } catch (err: any) {
    return {
      content: `PowerShell execution failed: ${err.message}\n${err.stderr ?? ""}`,
      isError: true,
    };
  }
};
