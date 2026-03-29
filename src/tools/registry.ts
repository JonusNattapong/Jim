import type { ToolDefinition, ToolHandler, ToolResult } from "./types.js";
import { read_file_definition, read_file_handler } from "./read_file.js";
import { edit_file_definition, edit_file_handler } from "./edit_file.js";
import { write_file_definition, write_file_handler } from "./write_file.js";
import { run_command_definition, run_command_handler } from "./run_command.js";
import { list_files_definition, list_files_handler } from "./list_files.js";
import { grep_definition, grep_handler } from "./grep.js";
import {
  git_command_definition, git_command_handler,
  get_project_info_definition, get_project_info_handler,
} from "./git.js";
import { todo_write_definition, todo_write_handler } from "./todo.js";
import {
  web_fetch_definition, web_fetch_handler,
  web_search_definition, web_search_handler,
} from "./web.js";
import { spawn_agent_definition, spawn_agent_handler } from "./spawn_agent.js";
import { get_repo_map_definition, get_repo_map_handler } from "./get_repo_map.js";
import { ask_user_choice_definition, ask_user_choice_handler } from "./ask_user_choice.js";
import { list_plugins_definition, list_plugins_handler } from "./plugin_catalog.js";
import { browser_action_definition, browser_action_handler } from "./browser.js";
import { reflect_definition, reflect_handler } from "./reflect.js";
import { ts_check_definition, ts_check_handler } from "./ts_check.js";
import { graph_query_definition, graph_query_handler } from "./graph_query.js";
import {
  memory_archive_definition, memory_archive_handler,
  memory_recall_definition, memory_recall_handler,
  memory_list_definition, memory_list_handler,
  memory_forget_definition, memory_forget_handler,
} from "./memory.js";
import { youtube_transcript_definition, youtube_transcript_handler } from "./youtube_transcript.js";
import { twitter_read_definition, twitter_read_handler } from "./twitter_read.js";
import { reddit_read_definition, reddit_read_handler } from "./reddit_read.js";
import { social_doctor_definition, social_doctor_handler } from "./social_doctor.js";
import { office_definition, office_handler } from "./office.js";
import { office_doctor_definition, office_doctor_handler } from "./office_doctor.js";

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  dangerous?: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, ToolEntry>();

  constructor() {
    // File operations
    this.register(read_file_definition, read_file_handler);
    this.register(edit_file_definition, edit_file_handler);
    this.register(write_file_definition, write_file_handler);
    this.register(list_files_definition, list_files_handler);

    // Search
    this.register(grep_definition, grep_handler);

    // Execution
    this.register(run_command_definition, run_command_handler, true);
    this.register(git_command_definition, git_command_handler);

    // Project
    this.register(get_project_info_definition, get_project_info_handler);
    this.register(get_repo_map_definition, get_repo_map_handler);

    // Task tracking
    this.register(todo_write_definition, todo_write_handler);
    this.register(ask_user_choice_definition, ask_user_choice_handler);

    // Web
    this.register(web_fetch_definition, web_fetch_handler);
    this.register(web_search_definition, web_search_handler);
    this.register(list_plugins_definition, list_plugins_handler);

    // Reasoning
    this.register(reflect_definition, reflect_handler);

    // TypeScript compiler
    this.register(ts_check_definition, ts_check_handler);

    // Browser automation
    this.register(browser_action_definition, browser_action_handler);

    // Codebase knowledge graph
    this.register(graph_query_definition, graph_query_handler);

    // Social media / internet access
    this.register(youtube_transcript_definition, youtube_transcript_handler);
    this.register(twitter_read_definition, twitter_read_handler);
    this.register(reddit_read_definition, reddit_read_handler);
    this.register(social_doctor_definition, social_doctor_handler);

    // Office documents (Word, Excel, PowerPoint)
    this.register(office_definition, office_handler);
    this.register(office_doctor_definition, office_doctor_handler);

    // Agents
    this.register(spawn_agent_definition, spawn_agent_handler);
  }

  register(definition: ToolDefinition, handler: ToolHandler, dangerous = false): void {
    // Sanitize: ensure parameters.properties is never empty for strict providers
    if (!definition.function.parameters.properties || Object.keys(definition.function.parameters.properties).length === 0) {
      definition.function.parameters = {
        type: "object",
        properties: {
          _reason: { type: "string", description: "Why are you calling this tool?" }
        },
        required: []
      };
    }
    this.tools.set(definition.function.name, { definition, handler, dangerous });
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: `Unknown tool: ${name}`, isError: true };
    }
    return tool.handler(args);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  isDangerous(name: string): boolean {
    return this.tools.get(name)?.dangerous ?? false;
  }
}

export type { ToolDefinition, ToolHandler, ToolResult } from "./types.js";
