import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "../tools/types.js";
import { CodeIntelService } from "../services/lsp/intel.ts";

export const code_intel_definition: ToolDefinition = {
  name: "code_intel",
  function: {
    name: "code_intel",
    description: "Deep semantic code intelligence. Use this to find where symbols (functions, classes, etc.) are defined, list all symbols in a file, or find every reference of a symbol across the project.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get_symbols", "find_definitions", "find_references"], description: "The intelligence action to perform" },
        path: { type: "string", description: "File path (for 'get_symbols')" },
        symbol: { type: "string", description: "Symbol name (for 'find_definitions' or 'find_references')" }
      },
      required: ["action"]
    }
  }
};

export const code_intel_handler: ToolHandler = async (args: any, context) => {
  const intel = new CodeIntelService(context.projectRoot || process.cwd());

  switch (args.action) {
    case "get_symbols": {
      if (!args.path) return { content: "Error: 'path' is required for 'get_symbols'.", isError: true };
      const symbols = await intel.getSymbols(args.path);
      if (symbols.length === 0) return { content: `No symbols found in ${args.path}` };
      
      const formatted = symbols.map(s => 
        `- [Line ${s.line}] ${s.name} (${s.kind})`
      ).join("\n");
      
      return { content: `Symbols in ${args.path}:\n\n${formatted}` };
    }
    case "find_definitions": {
      if (!args.symbol) return { content: "Error: 'symbol' is required for 'find_definitions'.", isError: true };
      const defs = await intel.findDefinitions(args.symbol);
      if (defs.length === 0) return { content: `No definitions found for '${args.symbol}'` };
      
      const formatted = defs.map(d => 
        `- [File ${d.file}:L${d.line}] ${d.preview}`
      ).join("\n");
      
      return { content: `Definitions for '${args.symbol}':\n\n${formatted}` };
    }
    case "find_references": {
      if (!args.symbol) return { content: "Error: 'symbol' is required for 'find_references'.", isError: true };
      const refs = await intel.findReferences(args.symbol);
      if (refs.length === 0) return { content: `No references found for '${args.symbol}'` };
      
      const formatted = refs.map(r => 
        `- [File ${r.file}:L${r.line}] ${r.preview}`
      ).join("\n");
      
      return { content: `References for '${args.symbol}':\n\n${formatted}` };
    }
    default:
      return { content: `Invalid action: ${args.action}`, isError: true };
  }
};
