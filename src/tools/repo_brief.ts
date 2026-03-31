import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { RepoBriefService } from "../services/repo-brief.ts";

export const repo_brief_definition: ToolDefinition = {
  name: "repo_brief",
  function: {
    name: "repo_brief",
    description: "Get a high-level architectural overview of the project. This is much faster than running 'ls' recursively and provides insights into tech stack, entry points, and recently active files.",
    parameters: {
      type: "object",
      properties: {
        _reason: { type: "string", description: "Why are you requesting a repo briefing?" }
      },
      required: []
    }
  }
};

export const repo_brief_handler: ToolHandler = async (args: any, context) => {
  const brief = new RepoBriefService(context.projectRoot || process.cwd());
  const report = await brief.getBrief();
  
  return { 
    content: `Project Briefing for ${context.projectRoot || process.cwd()}:\n\n${report}` 
  };
};
