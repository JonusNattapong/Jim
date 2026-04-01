import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from "openai/resources/chat/completions";
import { ToolRegistry } from "../tools/index.js";
import { get_repo_map_handler } from "../tools/get_repo_map.js";
import { buildSystemPrompt, buildEnhancedSystemPrompt, createSystemPromptBuilder, type WorkMode } from "./prompt.js";
import { 
  DEFAULT_AGENT_PROMPT,
  buildOutputStylePrompt,
  type OutputStyleConfig,
} from "../constants/index.js";
import { ContextManager } from "../context/manager.js";
import { MemoryManager } from "../context/memory.js";
import { SessionManager } from "../context/sessions.js";
import type { SessionData } from "../context/sessions.js";
import { HookEngine } from "./hooks.js";
import { PermissionManager } from "../permissions/manager.js";
import type { PermissionMode } from "../permissions/manager.js";
import { spawnSubAgent, spawnParallelAgents } from "./subagent.js";
import type { SubAgentConfig, SubAgentRole } from "./subagent.js";
import { executeSwarm, buildGraphFromTeam, createDevTeam, createResearchTeam } from "./swarm.js";
import { createProvider, getProviderMetadata, getProviderRegistry, inferProviderFromModel, normalizeProviderMode } from "./provider.js";
import type { LLMProvider, ProviderMetadata, ProviderMode, ProviderName } from "./provider.js";
import { childLogger } from "../utils/logger.js";
import { join } from "node:path";
import { ToolResultPersister, formatToolResultWithPersistence } from "../agent/tool-result-persistence.js";
import SessionMemoryManager from "../agent/session-memory.js";
import { AutoCompactionCircuitBreaker } from "../agent/compaction-circuit-breaker.js";
import { UnifiedCommandQueue } from "../agent/command-queue.js";
import { StreamingToolExecutor } from "../agent/streaming-executor.js";
import { ToolAnalytics } from "../tools/analytics.js";
import type { AnalyticsSnapshot } from "../tools/analytics.js";
import type { MCPManager } from "../tools/mcp.js";
import { formatProviderSetupInstructions, getProviderPreset, getProviderPresets, resolveProviderPreset } from "../config/provider-presets.js";
import { loadProviderSettings, saveProviderSelection, saveProviderSettings } from "../config/provider-store.js";
import { ReflexionEngine } from "./reflexion.js";
import type { Reflection } from "./reflexion.js";
import { getArchivalMemoryStore } from "../context/memory-store.js";
import { TreeSearchEngine } from "./tree_search.js";
import type { SimulationResult, TreeSearchResult } from "./tree_search.js";
import { UserPersonaManager } from "../context/persona.js";
import { SkillStore } from "./skill_store.js";
import { ConsolidationEngine } from "./consolidation.js";

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTurns: number;
  maxToolOutput: number;
  projectRoot: string;
  permissionMode?: PermissionMode;
  streaming?: boolean;
  api?: ProviderMode;
  providerPreset?: string;
  enableOllamaBackground?: boolean;
  ollamaModel?: string;
}

export interface AgentCallbacks {
  onThinking?: (content: string) => void;
  onStreamChunk?: (chunk: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, content: string, isError: boolean, diff?: string) => void;
  onChoiceRequest?: (prompt: string, choices: Array<{ label: string; value: string; description?: string }>) => Promise<string>;
  onError?: (error: string) => void;
  onPermissionRequest?: (toolName: string, args: Record<string, unknown>, diffPreview?: { filePath: string; diff: string; linesAdded: number; linesRemoved: number }) => Promise<boolean>;
  onMemoryLoaded?: (layers: number) => void;
  onHookFired?: (event: string, output: string) => void;
  onSessionSaved?: (sessionId: string) => void;
  onReflexion?: (reflection: Reflection) => void;
}

export class Agent {
  client: OpenAI;
  provider: LLMProvider;
  tools: ToolRegistry;
  analytics: ToolAnalytics;
  private log;
  private context: ContextManager;
  private memory: MemoryManager;
  private sessions: SessionManager;
  private hooks: HookEngine;
  private permissions: PermissionManager;
  private config: AgentConfig;
  private sessionId: string;
  private turnCount = 0;
  private workMode: WorkMode = "code";
  private mcp?: MCPManager;
  private mcpServers: string[] = [];
  private modelsCache: string[] = [];
  private cachedRepoMap: string | null = null;
  private reflexion!: ReflexionEngine;
  private treeSearch?: TreeSearchEngine;
  private lastReflectionInjection: number = -1;
  private persona: UserPersonaManager;
  private skillStore: SkillStore;
  private consolidation: ConsolidationEngine;
  // New integrations
  private persister?: ToolResultPersister;
  private sessionMemory?: SessionMemoryManager;
  private compactionBreaker?: AutoCompactionCircuitBreaker;
  private commandQueue?: UnifiedCommandQueue;
  private streamingExecutor?: StreamingToolExecutor;
  // ClaudeCode-style prompt system
  private systemPromptBuilder: ReturnType<typeof createSystemPromptBuilder>;
  private outputStyle: OutputStyleConfig | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.provider = this.createCompatibleProvider(config.model, config.api);
    this.tools = new ToolRegistry();
    this.analytics = new ToolAnalytics();
    this.context = new ContextManager(config.maxToolOutput);
    this.memory = new MemoryManager(config.projectRoot);
    this.sessions = new SessionManager(config.projectRoot);
    this.hooks = new HookEngine();
    this.permissions = new PermissionManager(config.permissionMode ?? "ask", config.projectRoot);
    this.sessionId = this.sessions.generateId();
    this.log = childLogger({ component: "agent", model: config.model, session: this.sessionId });

    // Initialize ClaudeCode-style prompt builder
    this.systemPromptBuilder = createSystemPromptBuilder(config.model, this.outputStyle);

    // Initialize reflexion engine for self-critique
    this.reflexion = new ReflexionEngine(this.provider, config.model);

    // Initialize learning systems
    this.persona = new UserPersonaManager(config.projectRoot);
    this.skillStore = new SkillStore(config.projectRoot);
    this.consolidation = new ConsolidationEngine(this.provider, config.model, this.persona, this.skillStore);

    // Wire up LLM-based context summarization
    this.context.setSummarizer(async (messages) => {
      const bgProvider = this.getBackgroundProvider();
      const bgModel = this.getBackgroundModel();
      const result = await bgProvider.complete(
        [
          { role: "system", content: "Summarize the following conversation concisely. Include key decisions, tool results, and current state. Be brief but preserve important details." },
          ...messages,
        ],
        [],
        { model: bgModel, maxTokens: 1000 },
      );
      return result.content;
    });
  }

  setOllamaBackground(enabled: boolean, model?: string) {
    this.config.enableOllamaBackground = enabled;
    if (model) this.config.ollamaModel = model;
    this.log.info({ enabled, model: this.config.ollamaModel }, "Ollama background tasks updated");
  }

  getOllamaBackgroundState() {
    return { enabled: this.config.enableOllamaBackground, model: this.config.ollamaModel || "llama3.1" };
  }

  /**
   * Set output style for ClaudeCode-style prompt formatting
   */
  setOutputStyle(style: OutputStyleConfig | null): void {
    this.outputStyle = style;
    this.systemPromptBuilder.setOutputStyle(style);
    this.log.info({ style: style?.name ?? "default" }, "Output style updated");
  }

  /**
   * Get current output style
   */
  getOutputStyle(): OutputStyleConfig | null {
    return this.outputStyle;
  }

  private getBackgroundProvider(): LLMProvider {
    if (this.config.enableOllamaBackground) {
      const ollamaClient = new OpenAI({
        apiKey: "ollama",
        baseURL: "http://127.0.0.1:11434/v1",
      });
      return createProvider(ollamaClient, { provider: "openai-compatible" });
    }
    return this.provider;
  }

  private getBackgroundModel(): string {
    return this.config.enableOllamaBackground ? (this.config.ollamaModel || "llama3.1") : this.config.model;
  }

  async init(callbacks: AgentCallbacks = {}): Promise<void> {
    await this.memory.loadAll();
    callbacks.onMemoryLoaded?.(this.memory.getLayers().length);
    await this.hooks.loadFromFile();

    // Load learning data
    await this.persona.load();
    await this.skillStore.load();

    // Load persisted permission decisions
    await this.permissions.loadPersisted();

    // Initialize auxiliary systems: persister, session memory, compaction breaker, command queue, streaming executor
    try {
      this.persister = new ToolResultPersister(join(this.config.projectRoot, ".jim", "tool-results"), this.sessionId);
      await this.persister.initialize();
    } catch (err) {
      this.log.warn({ err: String(err) }, "Failed to initialize ToolResultPersister");
      this.persister = undefined;
    }

    try {
      this.sessionMemory = new SessionMemoryManager(this.sessionId, { storageDir: join(this.config.projectRoot, ".jim", "sessions", this.sessionId) });
      await this.sessionMemory.initialize();
    } catch (err) {
      this.log.warn({ err: String(err) }, "Failed to initialize SessionMemoryManager");
      this.sessionMemory = undefined;
    }

    // Circuit breaker for auto-compaction
    try {
      this.compactionBreaker = new AutoCompactionCircuitBreaker();
    } catch (err) {
      this.log.warn({ err: String(err) }, "Failed to initialize AutoCompactionCircuitBreaker");
      this.compactionBreaker = undefined;
    }

    // Command queue and streaming executor (optional)
    try {
      this.commandQueue = new UnifiedCommandQueue();
      this.streamingExecutor = new StreamingToolExecutor({ maxConcurrent: 5 });
    } catch (err) {
      this.log.warn({ err: String(err) }, "Failed to initialize command queue or streaming executor");
      this.commandQueue = undefined;
      this.streamingExecutor = undefined;
    }

    // Load MCP servers
    if (process.env.JIM_SKIP_MCP !== "1") {
      try {
        const { MCPManager } = await import("../tools/mcp.js");
        const mcp = new MCPManager();
        this.mcp = mcp;
        await mcp.loadFromConfig();

        const reRegisterMcpTools = () => {
          const newDefs = mcp.getAllToolDefinitions();
          const newDefMap = new Map(newDefs.filter(d => d?.function?.name).map((d) => [d.function.name, d]));
          for (const [toolName, handler] of mcp.getAllHandlers()) {
            const def = newDefMap.get(toolName);
            if (def) {
              this.tools.register(def, handler);
            }
          }
          this.log.info({ toolCount: newDefs.length }, "MCP tools re-registered after change");
        };

        reRegisterMcpTools();

        // Re-register tools when MCP server tools change
        mcp.setOnToolsChanged(() => reRegisterMcpTools());

        // Register the dynamic MCP manager tool
        const { buildMcpManagerDefinition, buildMcpManagerHandler, MCP_SERVER_PRESETS } = await import("../tools/mcp_dynamic.js");
        const presetNames = Object.keys(MCP_SERVER_PRESETS);
        const mcpManagerDef = buildMcpManagerDefinition(presetNames);
        const mcpManagerHandler = buildMcpManagerHandler(mcp, reRegisterMcpTools);
        this.tools.register(mcpManagerDef, mcpManagerHandler);

        this.mcpServers = mcp.listServers();
        this.log.info({ mcpServers: this.mcpServers }, "MCP servers loaded");
      } catch { /* MCP optional */ }
    }

    this.log.info({
      memoryLayers: this.memory.getLayers().length,
      hooksLoaded: this.hooks.list().length,
      toolsRegistered: this.tools.getDefinitions().length,
    }, "agent initialized");
  }

  async run(userMessage: string, callbacks: AgentCallbacks = {}): Promise<string> {
    const runStart = Date.now();
    this.log.debug({ msgLen: userMessage.length }, "run start");

    // PreSession hook
    const preSession = await this.hooks.fire("PreSession", {
      SESSION_ID: this.sessionId,
      MODEL: this.config.model,
      PROJECT_ROOT: this.config.projectRoot,
    });
    if (preSession.blocked) {
      callbacks.onHookFired?.("PreSession", preSession.output);
      return `Session blocked: ${preSession.output}`;
    }
    if (preSession.output) callbacks.onHookFired?.("PreSession", preSession.output);

    if (this.cachedRepoMap === null && this.turnCount === 0) {
      callbacks.onThinking?.("[Generating repository map...]");
      try {
        const repoMapResult = await get_repo_map_handler({ dir: this.config.projectRoot, maxDepth: 4 });
        if (!repoMapResult.isError && repoMapResult.content) {
          this.cachedRepoMap = repoMapResult.content;
        } else {
          this.cachedRepoMap = "";
        }
      } catch {
        this.cachedRepoMap = ""; 
      }
    }

    const memoryContext = this.memory.buildContext();
    const repoMapStr = this.cachedRepoMap ? this.cachedRepoMap : "";
    
    // Inject persona and learned skills into the prompt
    const personaContext = this.persona.buildPromptFragment();
    const skillsContext = this.skillStore.buildPromptFragment();

    // Use ClaudeCode-style system prompt builder
    const systemPrompt = this.systemPromptBuilder.build({
      memoryContext,
      personaContext,
      skillsContext,
      repoMap: repoMapStr,
      environmentInfo: `Path: ${this.config.projectRoot}\nPlatform: ${process.platform}`,
    });
    
    // Auto-compact before adding new message if tokens are high (threshold: 100k)
    if (this.context.estimateTokens() > 100000) {
      if (!this.compactionBreaker || this.compactionBreaker.canAttemptCompaction()) {
        callbacks.onThinking?.("[Compacting context...]");
        try {
          await this.autoArchiveContext("pre-compaction");
          await this.context.compact();
          this.compactionBreaker?.recordSuccess();
        } catch (err: unknown) {
          this.compactionBreaker?.recordFailure(String(err ?? "unknown"));
          this.log.warn({ err: String(err) }, "Compaction failed (pre-compaction)");
        }
      } else {
        callbacks.onThinking?.("[Compaction disabled: previous failures]");
      }
    }

    // Reset plan approval for every new message/task
    this.permissions.setPlanApproved(false);

    this.context.addUserMessage(userMessage);

    const maxTurns = this.config.maxTurns;
    const streaming = this.config.streaming ?? false;
    const toolDefs = this.tools.getDefinitions();
    let consecutiveErrors = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      try {
        const messages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          ...this.context.getMessages(),
        ];

        let content = "";
        let toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
        let finishReason: string | null = null;

        const result = await this.callProviderWithFallback(messages, toolDefs, streaming, callbacks);

        content = result.content;
        toolCalls = result.toolCalls.map((tc) => ({
          id: tc.id,
          function: { name: tc.name, arguments: tc.arguments },
        }));
        finishReason = result.finishReason;

        this.context.addAssistantMessage({
          content: content || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : null,
        });

        // No tool calls — done
        if (finishReason === "stop" || toolCalls.length === 0) {
          callbacks.onThinking?.(content);
          if (content && content.length > 50) {
            // Intelligently auto-learn important facts
            await this.tryAutoLearn(userMessage, content);
          }
          await this.saveSession(callbacks);

          // Proactively consolidate session (Persona + Skills)
          await this.consolidation.consolidate(this.context.getMessages());

          this.log.info({ turns: this.turnCount + 1, durationMs: Date.now() - runStart }, "run complete");
          return content;
        }

        // Execute tool calls
        const toolResults: ChatCompletionToolMessageParam[] = [];
        const toolMemoryCandidates: Array<{ toolName: string; rawContent: string; displayContent: string; persisted: boolean; reference?: string }> = [];

        for (const toolCall of toolCalls) {
          const name = toolCall?.function?.name ?? (toolCall as any)?.name;
          if (!name) continue;

          let args: Record<string, unknown>;
          try { args = JSON.parse(toolCall?.function?.arguments ?? (toolCall as any)?.arguments ?? "{}"); }
          catch { args = {}; }

          callbacks.onToolCall?.(name, args);
          this.log.debug({ tool: name, argKeys: Object.keys(args) }, "tool call");

          // Permissions
          const permResult = await this.permissions.check(name, args);
          if (!permResult.allowed) {
            callbacks.onToolResult?.(name, `⛔ ${permResult.reason}`, true);
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: `Permission denied: ${permResult.reason}`, name } as any);
            continue;
          }

          if (permResult.needsApproval) {
            // Generate diff preview for file mutation tools before asking permission
            let diffPreview: { filePath: string; diff: string; linesAdded: number; linesRemoved: number } | undefined;
            if (name === "edit_file" || name === "write_file") {
              try {
                const { generatePreviewDiff } = await import("../utils/preview-diff.js");
                diffPreview = await generatePreviewDiff(name, args) ?? undefined;
              } catch { /* non-fatal */ }
            }

            const approved = callbacks.onPermissionRequest
              ? await callbacks.onPermissionRequest(name, args, diffPreview)
              : await this.permissions.approve(`Allow ${name}(${JSON.stringify(args).slice(0, 100)})?`);

            if (!approved) {
              callbacks.onToolResult?.(name, "User denied", true);
              toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: "User denied permission.", name } as any);
              continue;
            }
            await this.permissions.saveDecision(name, args, true);
          }

          // PreToolUse hook
          const preHook = await this.hooks.fireForTool(name, { TOOL_NAME: name, TOOL_ARGS: JSON.stringify(args) });
          if (preHook.blocked) {
            callbacks.onHookFired?.("PreToolUse", preHook.output);
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: `Hook blocked: ${preHook.output}` });
            continue;
          }

          // Spawn sub-agent
          if (name === "spawn_agent") {
            const subResult = await this.handleSubAgent(args, callbacks);
            callbacks.onToolResult?.("spawn_agent", subResult.slice(0, 200), false);
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: subResult, name } as any);
            continue;
          }

          if (name === "ask_user_choice") {
            const choiceResult = await this.handleChoiceRequest(args, callbacks);
            callbacks.onToolResult?.("ask_user_choice", choiceResult.slice(0, 200), false);
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: choiceResult, name } as any);
            continue;
          }

          // Browser automation (delegates to MCP puppeteer or built-in web tools)
          if (name === "browser_action") {
            const browserResult = await this.handleBrowserAction(args, callbacks);
            callbacks.onToolResult?.("browser_action", browserResult.slice(0, 200), browserResult.startsWith("Error"));
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: browserResult, name } as any);
            continue;
          }

          // Execute tool
          const toolStart = Date.now();
          const result = await this.tools.execute(name, args);
          const toolDuration = Date.now() - toolStart;
          this.analytics.record(name, !result.isError, toolDuration, result.isError ? (typeof result.content === "string" ? result.content.slice(0, 200) : JSON.stringify(result.content).slice(0, 200)) : undefined);

          // Normalize raw content
          let rawToolContent = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

          // For file-editing tools, allow graph refresh notes to be appended to the raw content
          if (!result.isError && (name === "edit_file" || name === "write_file")) {
            try {
              const filePath = args.path as string | undefined;
              if (filePath) {
                const { autoRefreshGraphForFile } = await import("../tools/graph_query.js");
                const graphRefreshNote = await autoRefreshGraphForFile(filePath, this.config.projectRoot);
                if (graphRefreshNote) {
                  rawToolContent += `\n${graphRefreshNote}`;
                }
              }
            } catch {
              // Non-fatal: graph refresh should never block file edits.
            }
          }

          // Attempt to persist large tool outputs to disk and replace display content with a short reference
          let displayContent = rawToolContent;
          let persistedMeta: any = undefined;
          try {
            if (this.persister) {
              persistedMeta = await this.persister.persistToolResult(name, rawToolContent);
              if (persistedMeta?.persisted) {
                displayContent = formatToolResultWithPersistence(persistedMeta as any);
              }
            }
          } catch (err) {
            this.log.warn({ err: String(err), tool: name }, "Failed to persist tool result; continuing inline");
            displayContent = rawToolContent;
            persistedMeta = undefined;
          }

          const truncated = displayContent.length > this.config.maxToolOutput
            ? displayContent.slice(0, this.config.maxToolOutput) + "\n... (truncated)"
            : displayContent;

          if (result.isError) {
            consecutiveErrors++;
            this.reflexion.recordError(this.turnCount, name, truncated, JSON.stringify(args));
            this.log.warn({ tool: name, error: truncated.slice(0, 200), attempt: consecutiveErrors }, "tool error");

            // Check if we need reflexion (repeated pattern detection)
            if (this.reflexion.needsReflection(this.turnCount) && this.lastReflectionInjection !== this.turnCount) {
              callbacks.onThinking?.("[🔍 Reflexion triggered: Analyzing root cause...]");
              const reflection = await this.reflexion.reflect(this.turnCount);
              callbacks.onReflexion?.(reflection);

              // Inject reflection into context as a system message
              const reflectionText = this.reflexion.formatReflectionPrompt(reflection);
              this.context.addRawMessage({
                role: "system",
                content: reflectionText,
              } as never);
              this.lastReflectionInjection = this.turnCount;
              this.log.info({ rootCause: reflection.rootCause }, "reflexion injected into context");
            } else if (consecutiveErrors <= 3) {
              callbacks.onThinking?.(`[Tool Error] Fixing automatically (Attempt ${consecutiveErrors}/3)...`);
            }
          } else {
            consecutiveErrors = 0; // reset on success
            this.reflexion.recordSuccess();
          }

          // Push initial tool result
          toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: truncated, name } as any);

          // Queue for session-memory extraction (prefer raw content)
          toolMemoryCandidates.push({ toolName: name, rawContent: rawToolContent, displayContent, persisted: Boolean(persistedMeta?.persisted), reference: typeof persistedMeta?.content === 'object' ? persistedMeta.content?.$ref : undefined });

          // PostToolUse hook
          const postHook = await this.hooks.fireForTool(name, { TOOL_NAME: name, TOOL_RESULT: truncated, TOOL_ARGS: JSON.stringify(args) });
          if (postHook.output) {
            callbacks.onHookFired?.("PostToolUse", postHook.output);
            const hookText = `\n\n[System Hook Execution]:\n${postHook.output}`;
            toolResults[toolResults.length - 1].content += hookText;
            callbacks.onToolResult?.(name, truncated + hookText, result.isError ?? false, result.diff);
          } else {
            callbacks.onToolResult?.(name, truncated, result.isError ?? false, result.diff);
          }
        }

        this.context.addToolResults(toolResults);

        // Session memory extraction: extract lightweight facts from this assistant turn
        if (this.sessionMemory) {
          try {
            const memTurn = {
              messages: [{ role: "assistant", content: content ?? "" }],
              toolResults: toolMemoryCandidates.map(t => ({ toolName: t.toolName, content: t.rawContent })),
            };
            const extracted = await this.sessionMemory.extractFromTurn(memTurn as any);
            if (extracted && extracted.length > 0) {
              callbacks.onHookFired?.("SessionMemory", `Extracted ${extracted.length} memory items`);
            }
          } catch (err) {
            this.log.warn({ err: String(err) }, "Session memory extraction failed");
          }
        }

        // Auto-compaction
        if (this.context.estimateTokens() > 160_000) {
          this.log.info({ turn: this.turnCount, tokens: this.context.estimateTokens() }, "context compaction triggered");
          callbacks.onThinking?.("[Compacting context...]");
          await this.autoArchiveContext("mid-session");
          await this.context.compact();
        }

        this.turnCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes("402") || msg.includes("401") || msg.includes("403") || msg.includes("paid model") || msg.includes("credits")) {
          this.log.error({ turn: this.turnCount, error: msg }, "API auth/payment error");
          callbacks.onError?.(`API error: ${msg}`);
          return `Error: ${msg}`;
        }

        if (msg.includes("429") || msg.includes("rate limit")) {
          this.log.warn({ turn: this.turnCount }, "rate limited, retrying");
          callbacks.onThinking?.("[Rate limited, waiting 5s...]");
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        this.log.error({ turn: this.turnCount, error: msg }, "API error");
        callbacks.onError?.(`API error: ${msg}`);
        return `Error: ${msg}`;
      }
    }

    return `Reached maximum turns (${maxTurns}). The task may not be complete.`;
  }

  private async handleSubAgent(args: Record<string, unknown>, callbacks: AgentCallbacks): Promise<string> {
    const type = (args.type as string) ?? "explore";
    const prompt = args.prompt as string;
    if (!prompt) return "Error: sub-agent requires 'prompt'";
    const context = args.context as string | undefined;

    // ─── Team mode ───────────────────────────────────────
    if (type === "team-dev" || type === "team-research") {
      const teamConfig = type === "team-dev"
        ? createDevTeam(this.config.projectRoot)
        : createResearchTeam(this.config.projectRoot);

      const graph = buildGraphFromTeam(teamConfig);
      callbacks.onThinking?.(`[Launching ${teamConfig.name}: ${teamConfig.members.map(m => m.label).join(" → ")}]`);

      const result = await executeSwarm({
        graph,
        client: this.client,
        model: this.config.model,
        allTools: this.tools.getDefinitions(),
        toolExecutor: (name, args) => this.tools.execute(name, args),
        projectRoot: this.config.projectRoot,
        onNodeStart: (nodeId, label) => {
          callbacks.onThinking?.(`[${label} starting...]`);
        },
        onNodeComplete: (nodeId, label, output) => {
          callbacks.onThinking?.(`[${label} done]`);
        },
        onHandoff: (from, to, reason) => {
          callbacks.onThinking?.(`[Handoff: ${from} → ${to}]`);
        },
      });

      // Format the swarm result as a comprehensive summary
      const summary = [
        `## ${teamConfig.name} Execution Complete`,
        `Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s | Agents: ${result.agentsSpawned}`,
        `Path: ${result.executionPath.join(" → ")}`,
        "",
        ...result.executionPath.map(nodeId => {
          const node = graph.nodes.find(n => n.id === nodeId);
          const output = result.nodeResults[nodeId] ?? "No output";
          return `### ${node?.label ?? nodeId}\n${output.slice(0, 2000)}\n`;
        }),
      ].join("\n");

      return summary;
    }

    // ─── Parallel mode ───────────────────────────────────
    if (type === "parallel") {
      let tasks: string[];
      try {
        tasks = JSON.parse(prompt);
        if (!Array.isArray(tasks)) throw new Error("not array");
      } catch {
        return "Error: parallel mode requires prompt to be a JSON array of task strings";
      }

      callbacks.onThinking?.(`[Spawning ${tasks.length} parallel agents...]`);

      const readOnlyTools = ["read_file", "list_files", "grep", "get_project_info", "git_command", "get_repo_map"];
      const isReadOnly = ["explore", "planner", "reviewer"].includes((args.role as string) ?? "executor");
      const selectedTools = isReadOnly
        ? this.tools.getDefinitions().filter(d => readOnlyTools.includes(d.function.name))
        : this.tools.getDefinitions();

      const role = (args.role as SubAgentRole) ?? "executor";
      const configs: SubAgentConfig[] = tasks.map((task: string) => ({
        type: role,
        prompt: task,
        client: this.client,
        model: this.config.model,
        tools: selectedTools.map(d => ({
          type: "function" as const,
          function: d.function,
        })),
        toolExecutor: (name, args) => this.tools.execute(name, args),
        maxTurns: 10,
        context,
        provider: this.provider,
      }));

      const results = await spawnParallelAgents(configs);

      const summary = [
        `## Parallel Execution Complete (${tasks.length} agents)`,
        "",
        ...results.map((r, i) => `### Agent ${i + 1}: ${tasks[i].slice(0, 50)}\n${r.slice(0, 1500)}\n`),
      ].join("\n");

      return summary;
    }

    // ─── Single agent mode (existing) ────────────────────
    const readOnlyTools = ["read_file", "list_files", "grep", "get_project_info", "git_command", "get_repo_map"];
    const plannerReviewTools = this.tools.getDefinitions().filter((d) =>
      readOnlyTools.includes(d.function.name)
    );

    const allTools = this.tools.getDefinitions();
    const isReadOnly = ["explore", "planner", "reviewer"].includes(type);
    const isWebSurfer = type === "web_surfer";

    let selectedTools = allTools;
    if (isWebSurfer) {
      selectedTools = this.tools.getDefinitions().filter((d) =>
        ["web_search", "web_fetch"].includes(d.function.name)
      );
    } else if (isReadOnly) {
      selectedTools = plannerReviewTools;
    }

    const maxTurns = isWebSurfer ? 6
      : type === "explore" ? 8
      : type === "planner" ? 5
      : type === "reviewer" ? 5
      : 15;

    const subConfig: SubAgentConfig = {
      type: type as SubAgentRole,
      prompt,
      client: this.client,
      model: this.config.model,
      tools: selectedTools,
      toolExecutor: (name, args) => this.tools.execute(name, args),
      maxTurns,
      context,
      provider: this.provider,
    };

    callbacks.onThinking?.(`[Spawning ${type} sub-agent...]`);
    return spawnSubAgent(subConfig);
  }

  private async handleBrowserAction(args: Record<string, unknown>, callbacks: AgentCallbacks): Promise<string> {
    const action = args.action as string;
    const mcp = this.mcp;

    if (!mcp) {
      return "Error: MCP is not available. Browser automation requires MCP support.";
    }

    // Ensure puppeteer MCP server is loaded
    if (!mcp.hasServer("puppeteer")) {
      callbacks.onThinking?.("[Loading Puppeteer MCP server for browser automation...]");
      try {
        const { buildMcpManagerHandler } = await import("../tools/mcp_dynamic.js");
        const reRegister = () => {
          const newDefs = mcp.getAllToolDefinitions();
          const newDefMap = new Map(newDefs.filter(d => d?.function?.name).map((d) => [d.function.name, d]));
          for (const [toolName, handler] of mcp.getAllHandlers()) {
            const def = newDefMap.get(toolName);
            if (def) {
              this.tools.register(def, handler);
            }
          }
        };

        await mcp.addServer({
          name: "puppeteer",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-puppeteer"],
          maxReconnects: 1,
          reconnectDelay: 5000,
        });
        reRegister();
        callbacks.onThinking?.("[Puppeteer MCP server loaded]");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error loading Puppeteer MCP: ${msg}. Try: npm install -g @anthropic-ai/mcp-server-puppeteer`;
      }
    }

    // Map browser_action to puppeteer MCP tools
    switch (action) {
      case "navigate": {
        const url = args.url as string;
        if (!url) return "Error: 'url' is required for navigate action";
        return this.tools.execute("puppeteer__navigate", { url }).then((r) => r.content);
      }
      case "screenshot": {
        const filePath = args.file_path as string | undefined;
        const result = await this.tools.execute("puppeteer__screenshot", {
          name: filePath ? filePath.replace(/\.[^.]+$/, "") : "screenshot",
          ...(filePath ? { path: filePath } : {}),
        });
        return result.content;
      }
      case "click": {
        const selector = args.selector as string;
        if (!selector) return "Error: 'selector' is required for click action";
        return this.tools.execute("puppeteer__click", { selector }).then((r) => r.content);
      }
      case "type": {
        const selector = args.selector as string;
        const text = args.text as string;
        if (!selector || !text) return "Error: 'selector' and 'text' are required for type action";
        return this.tools.execute("puppeteer__fill", { selector, value: text }).then((r) => r.content);
      }
      case "extract": {
        const selector = args.selector as string;
        let text = "";
        if (selector) {
          text = await this.tools.execute("puppeteer__evaluate", {
            script: `document.querySelector('${selector}')?.textContent ?? ''`,
          }).then((r) => r.content);
        } else {
          text = await this.tools.execute("puppeteer__evaluate", {
            script: "document.body.innerText.slice(0, 10000)",
          }).then((r) => r.content);
        }

        if (this.config.enableOllamaBackground) {
          callbacks.onThinking?.(`[Ollama] Extracting clean data from ${text.length} chars...`);
          const bgProvider = this.getBackgroundProvider();
          const cleanResult = await bgProvider.complete(
             [{ role: "user", content: `Extract the main useful information or markdown content from the following raw web text. Make it clean and concise:\n\n${text.slice(0, 15000)}` }],
             [],
             { model: this.getBackgroundModel(), maxTokens: 2000 }
          );
          return cleanResult.content;
        }
        return text;
      }
      case "evaluate": {
        const script = args.script as string;
        if (!script) return "Error: 'script' is required for evaluate action";
        return this.tools.execute("puppeteer__evaluate", { script }).then((r) => r.content);
      }
      case "back": {
        return this.tools.execute("puppeteer__evaluate", {
          script: "window.history.back(); 'navigated back'",
        }).then((r) => r.content);
      }
      case "status": {
        const isLoaded = mcp.hasServer("puppeteer");
        const client = mcp.getClient("puppeteer");
        const tools = client?.getTools() ?? [];
        return `Browser automation: ${isLoaded ? "ready" : "not loaded"}\n` +
          `Available tools: [${tools.map((t) => t.name).join(", ")}]`;
      }
      default:
        return `Error: Unknown browser action: ${action}. Use: navigate, screenshot, click, type, extract, evaluate, back, status`;
    }
  }

  private inferProviderForModel(model: string): ProviderName {
    // 1. If model has a provider prefix (e.g. "opencode/mimo-v2-pro-free"),
    //    infer from the model name first. This ensures the correct provider
    //    is used even when the preset's adapter differs.
    if (model.includes("/")) {
      return inferProviderFromModel(model);
    }
    // 2. Use the current preset's adapter if available
    const preset = this.config.providerPreset ? getProviderPreset(this.config.providerPreset) : undefined;
    if (preset?.adapter) {
      return preset.adapter;
    }
    // 3. Fallback to normal inference
    return inferProviderFromModel(model);
  }

  private createCompatibleProvider(model: string, explicitApi?: ProviderMode): LLMProvider {
    const provider = !explicitApi || explicitApi === "auto"
      ? this.inferProviderForModel(model)
      : normalizeProviderMode(explicitApi) ?? this.inferProviderForModel(model);
    return createProvider(this.client, { provider });
  }

  private async callProviderWithFallback(
    messages: ChatCompletionMessageParam[],
    toolDefs: ReturnType<ToolRegistry["getDefinitions"]>,
    streaming: boolean,
    callbacks: AgentCallbacks,
  ) {
    try {
      if (streaming) {
        return await this.provider.stream(messages, toolDefs, { model: this.config.model }, (chunk) => {
          if (chunk.content) callbacks.onStreamChunk?.(chunk.content);
        });
      }

      return await this.provider.complete(messages, toolDefs, { model: this.config.model });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const shouldRetry = 
        (/400/i.test(msg) || /404/i.test(msg)) && 
        (
          msg.includes('expected "function"') || 
          msg.includes("Invalid input") || 
          msg.includes("tool") || 
          msg.includes("API error") ||
          (msg.includes("not found") && !msg.toLowerCase().includes("file")) 
        );

      if (!shouldRetry) throw err;

      // Logic: if current provider failed, try to flip between openai and openai-compatible
      // or switch to openai-compatible if it's some other provider (like anthropic/bedrock)
      const fallbackProvider: ProviderName = this.provider.name === "openai" ? "openai-compatible" : "openai";
      
      this.log.warn({ error: msg, from: this.provider.name, to: fallbackProvider }, "provider issue detected, retrying with fallback provider");
      callbacks.onThinking?.(`[Provider fallback] Retrying with ${fallbackProvider}...`);
      
      this.provider = createProvider(this.client, { provider: fallbackProvider });

      if ((this.config.api ?? "auto") === "auto") {
        this.config.api = "auto";
      }

      try {
        if (streaming) {
          return await this.provider.stream(messages, toolDefs, { model: this.config.model }, (chunk) => {
            if (chunk.content) callbacks.onStreamChunk?.(chunk.content);
          });
        }

        return await this.provider.complete(messages, toolDefs, { model: this.config.model });
      } catch {
        // Third fallback: strip tools entirely for providers that don't support tool calling
        this.log.warn("fallback also failed, retrying without tools");
        callbacks.onThinking?.("[Tools not supported by this model, retrying without tools...]");

        if (streaming) {
          return await this.provider.stream(messages, [], { model: this.config.model }, (chunk) => {
            if (chunk.content) callbacks.onStreamChunk?.(chunk.content);
          });
        }

        return await this.provider.complete(messages, [], { model: this.config.model });
      }
    }
  }

  private async handleChoiceRequest(args: Record<string, unknown>, callbacks: AgentCallbacks): Promise<string> {
    const prompt = typeof args.prompt === "string" ? args.prompt : "Choose an option";
    const rawChoices = args.choices;
    let choices: Array<{ label: string; value: string; description?: string }> = [];

    try {
      if (typeof rawChoices === "string") {
        choices = JSON.parse(rawChoices) as Array<{ label: string; value: string; description?: string }>;
      } else if (Array.isArray(rawChoices)) {
        choices = rawChoices as Array<{ label: string; value: string; description?: string }>;
      }
    } catch {
      return "Error: ask_user_choice received invalid choices JSON";
    }

    const filtered = choices
      .filter((choice) => typeof choice?.label === "string" && typeof choice?.value === "string")
      .slice(0, 5);

    if (filtered.length < 2) {
      return "Error: ask_user_choice requires at least 2 valid choices";
    }

    if (!callbacks.onChoiceRequest) {
      return `Choice required: ${prompt}\n` + filtered.map((choice) => `- ${choice.label} (${choice.value})`).join("\n");
    }

    const selected = await callbacks.onChoiceRequest(prompt, filtered);
    return `User selected: ${selected}`;
  }

  private async saveSession(callbacks: AgentCallbacks): Promise<void> {
    try {
      const session: SessionData = {
        id: this.sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: this.context.getMessages(),
        model: this.config.model,
        projectRoot: this.config.projectRoot,
        turnCount: this.turnCount,
        memoryFacts: this.memory.getLayers().map((l) => l.content),
        permissionMode: this.permissions.getMode(),
        workMode: this.workMode,
      };
      await this.sessions.save(session);
      callbacks.onSessionSaved?.(this.sessionId);

      // PostSession hook
      await this.hooks.fire("PostSession", {
        SESSION_ID: this.sessionId,
        TURN_COUNT: String(this.turnCount),
        MODEL: this.config.model,
      });
    } catch { /* non-fatal */ }
  }

  async loadSession(sessionId: string): Promise<boolean> {
    const session = await this.sessions.load(sessionId);
    if (!session) return false;
    this.sessionId = session.id;
    this.turnCount = session.turnCount;
    this.context.clear();

    // Restore all messages (not just user messages)
    for (const msg of session.messages) {
      this.context.addRawMessage(msg as never);
    }

    // Restore memory facts
    if (session.memoryFacts) {
      for (const fact of session.memoryFacts) {
        await this.memory.learn(fact);
      }
    }

    // Restore permission mode
    if (session.permissionMode) {
      this.permissions.setMode(session.permissionMode as never);
    }
    if (session.workMode) {
      this.workMode = session.workMode as WorkMode;
    }

    this.log.info({ sessionId, turnCount: session.turnCount, memoryCount: session.memoryFacts?.length ?? 0 }, "session restored");
    return true;
  }

  async listSessions(projectRoot?: string) { return this.sessions.list(projectRoot); }

  async deleteSession(sessionId: string) { return this.sessions.delete(sessionId); }

  async createCheckpoint(label: string) {
    const checkpoint = await this.sessions.createCheckpoint(this.sessionId, label);
    if (checkpoint) {
      await this.hooks.fire("OnCheckpoint", {
        SESSION_ID: this.sessionId,
        CHECKPOINT_ID: checkpoint.id,
        CHECKPOINT_LABEL: label,
        TURN_COUNT: String(this.turnCount),
      });
    }
    return checkpoint;
  }

  async listCheckpoints(sessionId?: string) { return this.sessions.listCheckpoints(sessionId ?? this.sessionId); }

  async restoreCheckpoint(checkpointId: string, sessionId?: string) {
    const targetSessionId = sessionId ?? this.sessionId;
    const restored = await this.sessions.restoreCheckpoint(targetSessionId, checkpointId);
    if (!restored) return null;
    await this.loadSession(targetSessionId);
    return restored;
  }

  async deleteCheckpoint(checkpointId: string, sessionId?: string) { return this.sessions.deleteCheckpoint(sessionId ?? this.sessionId, checkpointId); }

  private async tryAutoLearn(userMessage: string, response: string): Promise<void> {
    const combined = `${userMessage}\n${response}`;
    const patterns = [
      { pattern: /(?:the|my) project (?:uses|is built with|is) ([\w\+\-\.]+)/i, label: "Tech Stack" },
      { pattern: /(?:the|this) (?:build|test|lint|start|dev) command is:?\s*`?(.+?)`?(?:\n|$)/i, label: "Command" },
      { pattern: /(?:fixed|resolved|solved) (?:the |this )?(?:issue|bug|problem) (?:by|via) (.+?)(?:\.|$)/i, label: "Solution" },
      { pattern: /(?:note|important|remember|don't forget): (.+?)(?:\.|$)/i, label: "Key Note" },
      { pattern: /project name is:?\s*(.+)/i, label: "Project Name" },
      { pattern: /env(?:ironment)? var(?:iable)?s? (?:are|include):?\s*(.+)/i, label: "Env Config" },
    ];

    for (const { pattern, label } of patterns) {
      const match = combined.match(pattern);
      if (match && match[1]) {
        const fact = `${label}: ${match[1].trim()}`;
        // Prevent dupes
        if (!this.memory.getLayers().some(l => l.content.includes(match[1].trim()))) {
          await this.memory.learn(fact);
          this.log.info({ fact }, "auto-learned fact");
        }
      }
    }
  }

  /**
   * Auto-archive older messages before compaction so they persist in long-term memory.
   * Inspired by MemGPT's approach: instead of silently losing context, archive it.
   */
  private async autoArchiveContext(reason: string): Promise<void> {
    try {
      const messages = this.context.getMessages();
      if (messages.length <= 8) return;

      // Archive the messages that will be compacted away (all but last 6)
      const toArchive = messages.slice(0, -6);
      if (toArchive.length === 0) return;

      const store = getArchivalMemoryStore();
      const archiveMessages = toArchive.map((msg) => {
        const role = msg.role;
        let content = "";
        if (typeof msg.content === "string") content = msg.content;
        else if (Array.isArray(msg.content)) {
          content = msg.content.map((c: any) => c.text ?? "").join("");
        }
        const toolName = (msg as any)?.tool_calls?.[0]?.function?.name;
        return { role, content, toolName };
      }).filter((m) => m.content.length > 0);

      const archived = await store.archiveConversation(
        archiveMessages,
        this.sessionId,
        this.turnCount,
      );

      this.log.info({ archived, reason, totalMessages: toArchive.length }, "auto-archived context before compaction");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ error: msg }, "auto-archive failed (non-fatal)");
    }
  }

  compactContext(): void { this.context.compact(); }
  setPermissionMode(mode: PermissionMode): void { this.permissions.setMode(mode); }
  getPermissionMode(): PermissionMode { return this.permissions.getMode(); }
  addAllowPattern(pattern: string): void { this.permissions.addAllowPattern(pattern); }
  addDenyPattern(pattern: string): void { this.permissions.addDenyPattern(pattern); }
  async learn(fact: string): Promise<void> { await this.memory.learn(fact); }
  resetConversation(): void { this.context.clear(); this.sessionId = this.sessions.generateId(); this.turnCount = 0; }
  getConversationHistory(): ChatCompletionMessageParam[] { return this.context.getMessages(); }
  getHooks(): HookEngine { return this.hooks; }
  getMemory(): MemoryManager { return this.memory; }
  getSessionId(): string { return this.sessionId; }
  getTurnCount(): number { return this.turnCount; }
  getModel(): string { return this.config.model; }
  getProjectRoot(): string { return this.config.projectRoot; }
  getEstimatedTokens(): number { 
    // Add ~1000 tokens for system prompt + project metadata baseline
    return this.context.estimateTokens() + 1000; 
  }
  getAnalytics(): AnalyticsSnapshot { return this.analytics.getSnapshot(); }
  getAnalyticsReport(): string { return this.analytics.formatReport(); }
  async close(): Promise<void> {
    this.mcp?.disconnectAll();
  }
  setWorkMode(mode: WorkMode): void { this.workMode = mode; }
  getWorkMode(): WorkMode { return this.workMode; }
  setApiMode(api: ProviderMode): void {
    const normalized = api === "auto" ? "auto" : normalizeProviderMode(api) ?? "openai-compatible";
    this.config.api = normalized;
    this.provider = this.createCompatibleProvider(this.config.model, normalized);
  }
  getApiMode(): ProviderMode {
    return this.config.api ?? "auto";
  }
  getEffectiveProvider(): ProviderName {
    return this.provider.name;
  }
  getProviderPreset(): string | undefined {
    return this.config.providerPreset;
  }
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
  getProviderRegistry(): ProviderMetadata[] {
    return getProviderRegistry();
  }
  getProviderMetadata(name?: ProviderName): ProviderMetadata {
    return getProviderMetadata(name ?? this.getEffectiveProvider());
  }
  getRecommendedProviderForModel(model?: string): ProviderName {
    return this.inferProviderForModel(model ?? this.config.model);
  }
  getProviderPresets() {
    return getProviderPresets().map((preset) => {
      const resolved = resolveProviderPreset(preset.id, process.env, loadProviderSettings(this.config.projectRoot, preset.id));
      return {
        ...preset,
        configured: resolved?.configured ?? false,
        resolvedBaseUrl: resolved?.resolvedBaseUrl,
      };
    });
  }
  getResolvedProviderPreset(presetId: string) {
    return resolveProviderPreset(presetId, process.env, loadProviderSettings(this.config.projectRoot, presetId));
  }
  connectProviderPreset(presetId: string, values?: Record<string, string>): { ok: boolean; message: string; details?: string[] } {
    const preset = getProviderPreset(presetId);
    if (!preset) {
      return { ok: false, message: `Unknown provider preset: ${presetId}` };
    }

    if (!preset.adapter) {
      return {
        ok: false,
        message: `${preset.label} is catalog-only right now.`,
        details: formatProviderSetupInstructions(preset),
      };
    }

    const nextValues = values ?? loadProviderSettings(this.config.projectRoot, presetId);
    const resolved = resolveProviderPreset(presetId, process.env, nextValues);
    if (!resolved || !resolved.configured || !resolved.resolvedBaseUrl) {
      return {
        ok: false,
        message: `Missing configuration for ${preset.label}`,
        details: formatProviderSetupInstructions(preset),
      };
    }

    for (const [key, value] of Object.entries(resolved.envAssignments)) {
      process.env[key] = value;
    }
    if (values) {
      saveProviderSettings(this.config.projectRoot, presetId, values);
    }

    this.config.providerPreset = presetId;
    this.config.apiKey = resolved.apiKey;
    this.config.baseUrl = resolved.resolvedBaseUrl;
    this.config.api = preset.adapter;
    this.client = new OpenAI({
      apiKey: resolved.apiKey,
      baseURL: resolved.resolvedBaseUrl,
    });
    this.provider = this.createCompatibleProvider(this.config.model, this.config.api);
    saveProviderSelection(this.config.projectRoot, presetId);

    return {
      ok: true,
      message: `Connected ${preset.label}`,
      details: [
        `Adapter: ${preset.adapter}`,
        `Base URL: ${resolved.resolvedBaseUrl}`,
        `Setup fields: ${preset.fields.map((field) => field.envVar ?? field.key).join(", ")}`,
      ],
    };
  }
  getPluginCatalog(): Array<{ name: string; type: "builtin" | "mcp"; toolCount: number; tools: string[]; healthy?: boolean }> {
    const defs = this.tools.getDefinitions();
    const builtins = defs.filter((def) => def?.function?.name && !def.function.name.includes("__")).map((def) => def.function.name);
    const byServer = new Map<string, string[]>();

    for (const def of defs) {
      if (!def?.function?.name) continue;
      const [server, tool] = def.function.name.split("__");
      if (!tool) continue;
      const tools = byServer.get(server) ?? [];
      tools.push(tool);
      byServer.set(server, tools);
    }

    const plugins: Array<{ name: string; type: "builtin" | "mcp"; toolCount: number; tools: string[]; healthy?: boolean }> = [
      { name: "core", type: "builtin", toolCount: builtins.length, tools: builtins },
    ];

    const health = this.mcp?.healthCheck() ?? {};
    for (const [name, tools] of byServer) {
      plugins.push({ name, type: "mcp", toolCount: tools.length, tools, healthy: health[name] });
    }

    return plugins;
  }

  /**
   * Execute a registered tool by name from external callers (CLI/tests).
   */
  async runTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    try {
      return await this.tools.execute(name, args);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ tool: name, err: msg }, "runTool failed");
      return { content: `Tool execution failed: ${msg}`, isError: true };
    }
  }

  /**
   * Return raw tool definitions registered in the runtime.
   */
  listToolDefinitions() {
    try {
      return this.tools.getDefinitions();
    } catch (err) {
      this.log.warn({ err: String(err) }, "failed to list tool definitions");
      return [];
    }
  }

  /**
   * List persisted tool results (from ToolResultPersister)
   */
  async listToolResults(): Promise<import("./tool-result-persistence.js").StoredToolResult[] | { totalResults: number }> {
    if (!this.persister) return { totalResults: 0 };
    try {
      return this.persister.listAllResults();
    } catch (err) {
      this.log.warn({ err: String(err) }, "failed to list tool results");
      return { totalResults: 0 };
    }
  }

  /**
   * Retrieve a persisted tool result by reference (tool-result://...)
   */
  async retrieveToolResult(reference: string): Promise<string | null> {
    if (!this.persister) return null;
    try {
      return await this.persister.retrieveResult(reference);
    } catch (err) {
      this.log.warn({ err: String(err), reference }, "failed to retrieve tool result");
      return null;
    }
  }

  /**
   * Expose session memory entries (if session memory manager is active)
   */
  getSessionMemories(limit = 100) {
    try {
      return this.sessionMemory ? this.sessionMemory.getMemories(limit) : [];
    } catch (err) {
      this.log.warn({ err: String(err) }, "failed to get session memories");
      return [];
    }
  }

  // ─── MCP Helpers (CLI-friendly wrappers) ─────────────────────────────────
  async listMcpServers(): Promise<string[]> {
    try {
      return this.mcp?.listServers() ?? [];
    } catch (err) {
      this.log.warn({ err: String(err) }, "listMcpServers failed");
      return [];
    }
  }

  async getMcpStatus(): Promise<Array<{ name: string; healthy: boolean; toolCount: number; tools: string[] }>> {
    try {
      return this.mcp?.getServerStatus() ?? [];
    } catch (err) {
      this.log.warn({ err: String(err) }, "getMcpStatus failed");
      return [];
    }
  }

  async addMcpServer(config: { name: string; command: string; args?: string[]; cwd?: string; env?: Record<string, string>; maxReconnects?: number; reconnectDelay?: number }): Promise<{ ok: boolean; message: string }> {
    if (!this.mcp) return { ok: false, message: "MCP manager not available" };
    try {
      await this.mcp.addServer(config as any);
      this.mcpServers = this.mcp.listServers();
      return { ok: true, message: `Added ${config.name}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ err: msg, config }, "addMcpServer failed");
      return { ok: false, message: msg };
    }
  }

  async removeMcpServer(name: string): Promise<boolean> {
    if (!this.mcp) return false;
    try {
      const ok = await this.mcp.removeServer(name);
      this.mcpServers = this.mcp.listServers();
      return ok;
    } catch (err) {
      this.log.warn({ err: String(err), name }, "removeMcpServer failed");
      return false;
    }
  }

  async reconnectMcpServer(name: string): Promise<boolean> {
    if (!this.mcp) return false;
    try {
      const ok = await this.mcp.reconnectServer(name);
      return ok;
    } catch (err) {
      this.log.warn({ err: String(err), name }, "reconnectMcpServer failed");
      return false;
    }
  }

  async loadMcpConfig(path?: string): Promise<{ ok: boolean; message: string }> {
    if (!this.mcp) return { ok: false, message: "MCP manager not available" };
    try {
      await this.mcp.loadFromConfig(path ?? ".mcp.json");
      this.mcpServers = this.mcp.listServers();
      return { ok: true, message: "Loaded MCP config" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn({ err: msg }, "loadMcpConfig failed");
      return { ok: false, message: msg };
    }
  }

  setPlanApproved(approved: boolean): void {
    this.permissions.setPlanApproved(approved);
  }

  isPlanApproved(): boolean {
    return this.permissions.isPlanApproved();
  }

  setModel(model: string): void {
    this.config.model = model;
    this.provider = this.createCompatibleProvider(model, this.config.api);
  }

  async fetchModels(): Promise<string[]> {
    try {
      if (this.provider.listModels) {
        const fetched = await this.provider.listModels();
        if (fetched && fetched.length > 0) {
          this.modelsCache = fetched;
          return fetched;
        }
      }
    } catch (err) {
      this.log.error({ err }, "failed to fetch models");
    }
    return this.getAvailableModels();
  }

  getAvailableModels(): string[] {
    const staticModels = [
      // --- OpenCode Optimized ---
      "opencode/mimo-v2-pro",
      "opencode/kilo-v1-large",
      "opencode/zen-claude-3.5-sonnet",

      // --- OpenAI ---
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/o1-preview",
      "openai/o3-mini",

      // --- Anthropic ---
      "anthropic/claude-3-5-sonnet-20241022",
      "anthropic/claude-3-5-haiku-20241022",
      "anthropic/claude-3-opus-20240229",

      // --- Google ---
      "google/gemini-1.5-pro-002",
      "google/gemini-1.5-flash-002",
      "google/gemini-2.0-flash-exp",

      // --- DeepSeek ---
      "deepseek/deepseek-chat",
      "deepseek/deepseek-coder",
      "deepseek/deepseek-reasoner",

      // --- Mistral ---
      "mistral/mistral-large-latest",
      "mistral/pixtral-large-latest",

      // --- Groq ---
      "groq/llama-3.3-70b-versatile",
      "groq/mixtral-8x7b-32768",

      // --- OpenRouter ---
      "openrouter/anthropic/claude-3.5-sonnet",
      "openrouter/google/gemini-pro-1.5",
      "openrouter/meta-llama/llama-3.1-405b",
    ];

    // If we have fetched models from the API, prioritize them for accuracy
    if (this.modelsCache.length > 0) {
      return this.modelsCache;
    }

    return staticModels;
  }

  getReflexionEngine(): ReflexionEngine {
    return this.reflexion;
  }

  getTreeSearchEngine(testCommand?: string): TreeSearchEngine {
    if (!this.treeSearch) {
      this.treeSearch = new TreeSearchEngine({
        projectRoot: this.config.projectRoot,
        testCommand: testCommand ?? "",
        maxSimulations: 3,
      });
    }
    return this.treeSearch;
  }

  async runTreeSearch(
    candidates: Array<{ action: string; description: string; execute: () => Promise<void> }>,
    testCommand: string,
    callbacks: AgentCallbacks = {},
  ): Promise<TreeSearchResult> {
    const engine = this.getTreeSearchEngine(testCommand);
    const snapshotCreated = await engine.createSnapshot();

    if (!snapshotCreated) {
      return {
        bestPath: [],
        bestScore: 0,
        simulationsRun: 0,
        rollbacksPerformed: 0,
        summary: "Failed to create git snapshot. Tree search requires a clean git state.",
      };
    }

    let simulationsRun = 0;
    let rollbacksPerformed = 0;
    let bestCandidate = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      if (simulationsRun >= engine["config"].maxSimulations) break;

      callbacks.onThinking?.(`[LATS] Simulating: ${candidate.description}...`);

      // Execute the candidate action
      try {
        await candidate.execute();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log.warn({ err: msg, action: candidate.action }, "candidate execution failed");
        await engine.rollbackToSnapshot();
        rollbacksPerformed++;
        continue;
      }

      // Run simulation (tests)
      const result = await engine.simulate(candidate.action, candidate.description, testCommand);
      simulationsRun++;

      // Track best
      if (result.score > bestScore) {
        bestScore = result.score;
        bestCandidate = candidate;
      }

      // Rollback if simulation failed
      if (!result.success) {
        await engine.rollbackToSnapshot();
        rollbacksPerformed++;
        this.log.info({ action: candidate.action, score: result.score }, "simulation failed, rolled back");
      }
    }

    // Apply the best candidate
    if (bestScore > 0 && bestCandidate) {
      // Re-execute the best candidate (we rolled back everything)
      await engine.rollbackToSnapshot();
      try {
        await bestCandidate.execute();
      } catch {
        // best candidate re-execution failed
      }
    }

    const summary = `Tree search: ${simulationsRun} simulations, ${rollbacksPerformed} rollbacks. Best: "${bestCandidate?.description}" (score: ${bestScore.toFixed(2)})`;

    return {
      bestPath: engine.getBestPath(),
      bestScore,
      simulationsRun,
      rollbacksPerformed,
      summary,
    };
  }

  async simulateEdit(
    editDescription: string,
    editFn: () => Promise<void>,
    testCommand: string,
    callbacks: AgentCallbacks = {},
  ): Promise<{ success: boolean; score: number; output: string }> {
    const engine = this.getTreeSearchEngine(testCommand);
    const snapshotCreated = await engine.createSnapshot();

    if (!snapshotCreated) {
      return { success: false, score: 0, output: "Failed to create git snapshot" };
    }

    callbacks.onThinking?.(`[MCTS] Simulating edit: ${editDescription}...`);

    try {
      await editFn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await engine.rollbackToSnapshot();
      return { success: false, score: -1, output: `Edit execution failed: ${msg}` };
    }

    const result = await engine.simulate("edit", editDescription, testCommand);

    if (!result.success) {
      await engine.rollbackToSnapshot();
      callbacks.onThinking?.(`[MCTS] Edit broke tests. Rolled back. Score: ${result.score.toFixed(2)}`);
    }

    return {
      success: result.success,
      score: result.score,
      output: result.testOutput,
    };
  }
}
