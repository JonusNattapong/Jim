import type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ToolContext,
} from "./types.js";
import { PluginManager, type Plugin } from "../agent/plugins.js";

// Import all tool definitions and handlers
import { read_file_definition, read_file_handler } from "./read_file.js";
import { edit_file_definition, edit_file_handler } from "./edit_file.js";
import { write_file_definition, write_file_handler } from "./write_file.js";
import { run_command_definition, run_command_handler } from "./run_command.js";
import { list_files_definition, list_files_handler } from "./list_files.js";
import { grep_definition, grep_handler } from "./grep.js";
import {
  git_command_definition,
  git_command_handler,
  get_project_info_definition,
  get_project_info_handler,
} from "./git.js";
import {
  send_command_input_definition,
  send_command_input_handler,
} from "./send_command_input.js";
import { todo_write_definition, todo_write_handler } from "./todo.js";
import {
  web_fetch_definition,
  web_fetch_handler,
  web_search_definition,
  web_search_handler,
} from "./web.js";
import { spawn_agent_definition, spawn_agent_handler } from "./spawn_agent.js";
import {
  get_repo_map_definition,
  get_repo_map_handler,
} from "./get_repo_map.js";
import {
  cleanup_workspace_definition,
  cleanup_workspace_handler,
} from "./cleanup_workspace.js";
import {
  ask_user_choice_definition,
  ask_user_choice_handler,
} from "./ask_user_choice.js";
import {
  list_plugins_definition,
  list_plugins_handler,
} from "./plugin_catalog.js";
import {
  browser_action_definition,
  browser_action_handler,
} from "./browser.js";
import { reflect_definition, reflect_handler } from "./reflect.js";
import { ts_check_definition, ts_check_handler } from "./ts_check.js";
import { graph_query_definition, graph_query_handler } from "./graph_query.js";
import { mailbox_definition, mailbox_handler } from "./mailbox.js";
import { task_manage_definition, task_manage_handler } from "./task_manage.js";
import { code_intel_definition, code_intel_handler } from "./code_intel.js";
import { repo_brief_definition, repo_brief_handler } from "./repo_brief.js";
import {
  memory_archive_definition,
  memory_archive_handler,
  memory_recall_definition,
  memory_recall_handler,
  memory_list_definition,
  memory_list_handler,
  memory_forget_definition,
  memory_forget_handler,
} from "./memory.js";
import {
  youtube_transcript_definition,
  youtube_transcript_handler,
} from "./youtube_transcript.js";
import {
  twitter_read_definition,
  twitter_read_handler,
} from "./twitter_read.js";
import { reddit_read_definition, reddit_read_handler } from "./reddit_read.js";
import {
  social_doctor_definition,
  social_doctor_handler,
} from "./social_doctor.js";
import { office_definition, office_handler } from "./office.js";
import {
  office_doctor_definition,
  office_doctor_handler,
} from "./office_doctor.js";
import { pin_context_definition, pin_context_handler } from "./pin_context.js";
import { undo_edit_definition, undo_edit_handler } from "./undo_edit.js";
import {
  worktree_manage_definition,
  worktree_manage_handler,
} from "./worktree_manage.js";
import { powershell_definition, powershell_handler } from "./powershell.js";
import {
  notebook_edit_definition,
  notebook_edit_handler,
} from "./notebook_edit.js";
import {
  list_mcp_resources_definition,
  list_mcp_resources_handler,
} from "./mcp_resources.js";
import { mcp_auth_definition, mcp_auth_handler } from "./mcp_auth.js";
import {
  pending_messages_definition,
  pending_messages_handler,
} from "./pending_messages.js";

export class ToolRegistry {
  private pluginManager = new PluginManager();
  private dangerousTools = new Set<string>(["run_command"]);
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.registerBuiltInPlugins();
  }

  private registerBuiltInPlugins(): void {
    const plugins: Plugin[] = [
      {
        metadata: {
          name: "file-ops",
          description: "Efficiently handle file reading, editing and listing",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          { definition: read_file_definition, handler: read_file_handler },
          { definition: edit_file_definition, handler: edit_file_handler },
          { definition: write_file_definition, handler: write_file_handler },
          { definition: list_files_definition, handler: list_files_handler },
          { definition: pin_context_definition, handler: pin_context_handler },
          { definition: undo_edit_definition, handler: undo_edit_handler },
        ],
      },
      {
        metadata: {
          name: "system",
          description: "Interact with the host OS, git and project structure",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          { definition: run_command_definition, handler: run_command_handler },
          {
            definition: send_command_input_definition,
            handler: send_command_input_handler,
          },
          { definition: git_command_definition, handler: git_command_handler },
          {
            definition: worktree_manage_definition,
            handler: worktree_manage_handler,
          },
          {
            definition: get_project_info_definition,
            handler: get_project_info_handler,
          },
          {
            definition: get_repo_map_definition,
            handler: get_repo_map_handler,
          },
          {
            definition: cleanup_workspace_definition,
            handler: cleanup_workspace_handler,
          },
        ],
      },
      {
        metadata: {
          name: "search",
          description: "Grep the project or search the web for context",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          { definition: grep_definition, handler: grep_handler },
          { definition: web_fetch_definition, handler: web_fetch_handler },
          { definition: web_search_definition, handler: web_search_handler },
        ],
      },
      {
        metadata: {
          name: "social",
          description:
            "Read YouTube, Twitter/X and Reddit for real-time information",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          {
            definition: youtube_transcript_definition,
            handler: youtube_transcript_handler,
          },
          {
            definition: twitter_read_definition,
            handler: twitter_read_handler,
          },
          { definition: reddit_read_definition, handler: reddit_read_handler },
          {
            definition: social_doctor_definition,
            handler: social_doctor_handler,
          },
        ],
      },
      {
        metadata: {
          name: "office",
          description: "Work with Word, Excel, and PowerPoint documents",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          { definition: office_definition, handler: office_handler },
          {
            definition: office_doctor_definition,
            handler: office_doctor_handler,
          },
        ],
      },
      {
        metadata: {
          name: "memory",
          description: "Long-term knowledge storage and retrieval",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          {
            definition: memory_archive_definition,
            handler: memory_archive_handler,
          },
          {
            definition: memory_recall_definition,
            handler: memory_recall_handler,
          },
          { definition: memory_list_definition, handler: memory_list_handler },
          {
            definition: memory_forget_definition,
            handler: memory_forget_handler,
          },
        ],
      },
      {
        metadata: {
          name: "agent-intelligence",
          description: "High-level reasoning, agents and diagnostics",
          version: "1.0.0",
          type: "built-in",
        },
        enabled: true,
        tools: [
          { definition: todo_write_definition, handler: todo_write_handler },
          { definition: reflect_definition, handler: reflect_handler },
          { definition: ts_check_definition, handler: ts_check_handler },
          { definition: graph_query_definition, handler: graph_query_handler },
          { definition: task_manage_definition, handler: task_manage_handler },
          { definition: mailbox_definition, handler: mailbox_handler },
          { definition: code_intel_definition, handler: code_intel_handler },
          { definition: repo_brief_definition, handler: repo_brief_handler },
          { definition: spawn_agent_definition, handler: spawn_agent_handler },
          {
            definition: browser_action_definition,
            handler: browser_action_handler,
          },
          {
            definition: list_plugins_definition,
            handler: list_plugins_handler,
          },
          {
            definition: pending_messages_definition,
            handler: pending_messages_handler,
          },
        ],
      },
    ];

    for (const plugin of plugins) {
      // Sanitize tool parameters before registration
      for (const tool of plugin.tools) {
        if (
          !tool.definition.function.parameters.properties ||
          Object.keys(tool.definition.function.parameters.properties).length ===
            0
        ) {
          tool.definition.function.parameters = {
            type: "object",
            properties: {
              _reason: {
                type: "string",
                description: "Why are you calling this tool?",
              },
            },
            required: [],
          };
        }
      }
      this.pluginManager.registerPlugin(plugin);
    }
  }

  register(
    definition: ToolDefinition,
    handler: ToolHandler,
    dangerous = false,
  ): void {
    // Sanitize parameters
    if (
      !definition.function.parameters.properties ||
      Object.keys(definition.function.parameters.properties).length === 0
    ) {
      definition.function.parameters = {
        type: "object",
        properties: {
          _reason: {
            type: "string",
            description: "Why are you calling this tool?",
          },
        },
        required: [],
      };
    }

    if (dangerous) {
      this.dangerousTools.add(definition.function.name);
    }

    // Ensure a dynamic plugin exists for non-built-in tools
    let dynamicPlugin = this.pluginManager.getPlugin("mcp-dynamic");
    if (!dynamicPlugin) {
      dynamicPlugin = {
        metadata: {
          name: "mcp-dynamic",
          description: "Dynamically loaded MCP tools and extensions",
          version: "1.0.0",
          type: "mcp",
        },
        enabled: true,
        tools: [],
      };
      this.pluginManager.registerPlugin(dynamicPlugin);
    }

    // Add or replace the tool in the dynamic plugin
    const existingIndex = dynamicPlugin.tools.findIndex(
      (t) => t.definition.function.name === definition.function.name,
    );
    if (existingIndex >= 0) {
      dynamicPlugin.tools[existingIndex] = { definition, handler };
    } else {
      dynamicPlugin.tools.push({ definition, handler });
    }
  }

  getDefinitions(): ToolDefinition[] {
    return this.pluginManager.getEnabledTools().map((t) => t.definition);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    options?: { onProgress?: (message: string, percent: number) => void },
  ): Promise<ToolResult> {
    const tool = this.pluginManager
      .getEnabledTools()
      .find((t) => t.name === name);
    if (!tool) {
      return { content: `Unknown or disabled tool: ${name}`, isError: true };
    }

    // Pass registry and projectRoot in context
    const context: ToolContext = {
      registry: this,
      projectRoot: this.projectRoot,
      onProgress: options?.onProgress,
    };

    return tool.handler(args, context);
  }

  has(name: string): boolean {
    return this.pluginManager.getEnabledTools().some((t) => t.name === name);
  }

  isDangerous(name: string): boolean {
    return this.dangerousTools.has(name);
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }
}
