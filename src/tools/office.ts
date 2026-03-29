import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolHandler } from "./types.js";

const execFileAsync = promisify(execFile);

async function findOfficeCli(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("officecli", ["--version"], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function runOfficeCli(args: string[], timeout = 30000): Promise<string> {
  const { stdout } = await execFileAsync("officecli", args, {
    timeout,
    env: { ...process.env, OFFICECLI_SKIP_UPDATE: "1" },
  });
  return stdout.trim();
}

function isOfficeFile(path: string): boolean {
  return /\.(docx|xlsx|pptx)$/i.test(path);
}

export const office_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "office",
    description:
      "Create, read, modify, and validate Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents. " +
      "Uses OfficeCLI — a single binary, no Office installation required. " +
      "Commands: create, view, get, query, set, add, remove, move, validate, batch. " +
      "Supports --json for structured output on all commands.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Operation to perform",
          enum: ["create", "view", "get", "query", "set", "add", "remove", "move", "validate", "batch"],
        },
        file: {
          type: "string",
          description: "Path to the Office file (.docx, .xlsx, or .pptx)",
        },
        path: {
          type: "string",
          description: "Element path within the document (e.g. /slide[1]/shape[1], /body/p[1])",
        },
        type: {
          type: "string",
          description: "Element type for add command (e.g. slide, shape, sheet, paragraph)",
        },
        props: {
          type: "string",
          description: "Properties as comma-separated key=value pairs (e.g. 'text=Hello,size=24,color=FF0000')",
        },
        view_mode: {
          type: "string",
          description: "View mode: text, outline, annotated, stats, issues",
          enum: ["text", "outline", "annotated", "stats", "issues"],
        },
        depth: {
          type: "number",
          description: "Depth for get command (default: 1)",
        },
        json_output: {
          type: "boolean",
          description: "Return structured JSON output (default: true)",
        },
        to: {
          type: "string",
          description: "Destination parent path for move command",
        },
        index: {
          type: "number",
          description: "Target index for move/add command",
        },
      },
      required: ["command", "file"],
    },
  },
};

export const office_handler: ToolHandler = async (args) => {
  const command = args.command as string;
  const file = args.file as string;
  const elementPath = args.path as string | undefined;
  const elementType = args.type as string | undefined;
  const props = args.props as string | undefined;
  const viewMode = args.view_mode as string | undefined;
  const depth = args.depth as number | undefined;
  const jsonOutput = args.json_output !== false;
  const to = args.to as string | undefined;
  const index = args.index as number | undefined;

  const version = await findOfficeCli();
  if (!version) {
    return {
      content: "OfficeCLI is not installed. Install it with:\n  macOS/Linux: curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash\n  Windows: irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex\nOr download from: https://github.com/iOfficeAI/OfficeCLI/releases",
      isError: true,
    };
  }

  if (!isOfficeFile(file)) {
    return { content: `Error: File must be .docx, .xlsx, or .pptx. Got: ${file}`, isError: true };
  }

  try {
    const cliArgs: string[] = [command, file];

    switch (command) {
      case "create": {
        const result = await runOfficeCli(cliArgs);
        return { content: result || `Created: ${file}` };
      }

      case "view": {
        cliArgs.push(viewMode ?? "outline");
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "get": {
        if (!elementPath) return { content: "Error: 'path' is required for get command", isError: true };
        cliArgs.push(elementPath);
        if (depth != null) cliArgs.push("--depth", String(depth));
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "query": {
        if (!elementPath) return { content: "Error: 'path' (used as selector) is required for query command", isError: true };
        cliArgs.push(elementPath);
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "set": {
        if (!elementPath) return { content: "Error: 'path' is required for set command", isError: true };
        if (!props) return { content: "Error: 'props' is required for set command (e.g. 'text=Hello,size=24')", isError: true };
        cliArgs.push(elementPath);
        for (const prop of props.split(",")) {
          const trimmed = prop.trim();
          if (trimmed) cliArgs.push("--prop", trimmed);
        }
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "add": {
        if (!elementPath) return { content: "Error: 'path' (parent path) is required for add command", isError: true };
        if (!elementType) return { content: "Error: 'type' is required for add command (e.g. slide, shape, sheet)", isError: true };
        cliArgs.push(elementPath);
        cliArgs.push("--type", elementType);
        if (props) {
          for (const prop of props.split(",")) {
            const trimmed = prop.trim();
            if (trimmed) cliArgs.push("--prop", trimmed);
          }
        }
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "remove": {
        if (!elementPath) return { content: "Error: 'path' is required for remove command", isError: true };
        cliArgs.push(elementPath);
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "move": {
        if (!elementPath) return { content: "Error: 'path' is required for move command", isError: true };
        cliArgs.push(elementPath);
        if (to) cliArgs.push("--to", to);
        if (index != null) cliArgs.push("--index", String(index));
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "validate": {
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      case "batch": {
        if (!props) return { content: "Error: 'props' is required for batch command — provide JSON array of operations", isError: true };
        cliArgs.push("--input", props);
        if (jsonOutput) cliArgs.push("--json");
        const result = await runOfficeCli(cliArgs);
        return { content: result };
      }

      default:
        return { content: `Unknown command: ${command}. Valid: create, view, get, query, set, add, remove, move, validate, batch`, isError: true };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `OfficeCLI error: ${msg}`, isError: true };
  }
};
