import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { Header } from "./components/Header.js";
import { Message } from "./components/Message.js";
import { ToolActivity } from "./components/ToolActivity.js";
import type { ToolCallEntry } from "./components/ToolActivity.js";
import { ThinkingAnimation } from "./components/ThinkingAnimation.js";
import { StatusBar, StatusInfo } from "./components/StatusBar.js";
import { CommandOutput } from "./components/CommandOutput.js";
import type { CommandOutputEntry } from "./components/CommandOutput.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { SearchablePicker } from "./components/SearchablePicker.js";
import type { SearchablePickerItem } from "./components/SearchablePicker.js";
import { ConnectModal } from "./components/ConnectModal.js";
import { StatsView } from "./components/StatsView.js";
import { ConfigView } from "./components/ConfigView.js";
import { ThoughtProcess } from "./components/ThoughtProcess.js";
import { Agent } from "../agent/index.js";
import type { AgentCallbacks } from "../agent/index.js";
import handleMcpCommand from "./mcpCommand.js";
import type { PermissionMode } from "../permissions/manager.js";
import { loadCliUiState, pushRecent, saveCliUiState, toggleFavorite } from "./ui-state.js";
import { formatProviderDescription, formatConnectionListItem } from "../config/provider-presets.js";
import { theme, setTheme, THEME_LIST } from "./theme.js";
import { useVirtualScroll } from "./hooks/useVirtualScroll.js";
import { usePromptHistory } from "./hooks/usePromptHistory.js";
import { updateTaskStatusStore } from "./stores/taskStatusStore.js";
import { initializePromptHistoryStore, pushPromptHistoryStore, usePromptHistorySnapshot } from "./stores/promptHistoryStore.js";
import { useSessionSummarySnapshot } from "./stores/sessionSummaryStore.js";
import type { SessionSummary } from "../context/sessions.js";

// Initialize theme on first load
const initialState = loadCliUiState(process.cwd());
setTheme(initialState.themeId);

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Types ─────────────────────────────────────────────

const COMMANDS = [
  { cmd: "help", desc: "Show this help message" },
  { cmd: "model", desc: "Show or change AI model" },
  { cmd: "models", desc: "List available models" },
  { cmd: "provider", desc: "Show current provider service or adapter" },
  { cmd: "providers", desc: "Pick a provider service (OpenCode, OpenRouter, etc.)" },
  { cmd: "adapters", desc: "Pick a technical provider adapter (OpenAI, Anthropic, etc.)" },
  { cmd: "connect", desc: "Connect a provider service by ID" },
  { cmd: "connections", desc: "List all available provider services" },
  { cmd: "mode", desc: "Change permission mode (plan/default...)" },
  { cmd: "auto-approve", desc: "Toggle auto-approve mode" },
  { cmd: "workmode", desc: "Show or change architect/ask/code mode" },
  { cmd: "modes", desc: "Pick a work mode interactively" },
  { cmd: "learn", desc: "Add fact to memory" },
  { cmd: "rules", desc: "Show conditional rules" },
  { cmd: "compact", desc: "Compact conversation context" },
  { cmd: "stream", desc: "Toggle streaming mode" },
  { cmd: "sessions", desc: "List saved sessions" },
  { cmd: "load", desc: "Load a session by ID" },
  { cmd: "delete", desc: "Delete a session" },
  { cmd: "checkpoint", desc: "Create a checkpoint" },
  { cmd: "checkpoints", desc: "Browse checkpoints" },
  { cmd: "restore", desc: "Restore a checkpoint" },
  { cmd: "themes", desc: "Pick a UI color theme" },
  { cmd: "plugins", desc: "Browse plugin groups" },
  { cmd: "doctor", desc: "Run diagnostic checks (doctor)" },
  { cmd: "tool-results", desc: "List persisted tool outputs" },
  { cmd: "tool-retrieve", desc: "Retrieve persisted tool output by reference" },
  { cmd: "session-memory", desc: "Show session memory items" },
  { cmd: "history", desc: "Show message stats" },
  { cmd: "stats", desc: "Show usage statistics" },
  { cmd: "config", desc: "Show current config" },
  { cmd: "memory", desc: "Show memory layers" },
  { cmd: "approve", desc: "Approve the current proposed plan" },
  { cmd: "yolo", desc: "Toggle YOLO mode: bypass all safety checks" },
  { cmd: "ollaman", desc: "Toggle Ollaman for background tasks" },
  { cmd: "quit", desc: "Exit Jim" },
];

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallEntry[];
}

interface DiffPreviewData {
  filePath: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

interface PermissionRequest {
  toolName: string;
  args: string;
  diffPreview?: DiffPreviewData;
  resolve: (approved: boolean) => void;
}

interface SelectorItem {
  label: string;
  value: string;
  description?: string;
  keywords?: string[];
  preview?: string;
  previewLines?: number;
}

interface SelectorState {
  type: "model" | "provider" | "connection" | "session" | "checkpoint" | "choice" | "plugin" | "mode" | "history";
  title: string;
  items: SelectorItem[];
  favoritesKey?: "favoriteModels" | "favoriteProviders" | "favoriteConnections";
  recentsKey?: "recentModels" | "recentProviders" | "recentConnections";
  recents?: string[];
  onSelect: (value: string) => Promise<void> | void;
}

interface ConnectModalState {
  presetId: string;
  title: string;
  description: string;
  fields: Array<{ key: string; label: string; required?: boolean; secret?: boolean; placeholder?: string; envVar?: string }>;
  initialValues: Record<string, string>;
}

interface AppProps {
  agent: Agent;
  initialModel: string;
  initialMode: string;
  initialStreaming: boolean;
}

// ─── App ───────────────────────────────────────────────

const mapOpenAiToUiMessages = (messages: any[]): ChatMessage[] => {
  return messages
    .filter(msg => msg.role !== "system") // Don't show system prompt in UI
    .map(msg => {
      const uiMsg: ChatMessage = {
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : "",
      };

      if (msg.role === "assistant" && msg.tool_calls) {
        uiMsg.toolCalls = (msg.tool_calls as any[]).map((tc: any): ToolCallEntry => ({
          name: tc.function?.name ?? tc.name ?? "",
          args: typeof (tc.function?.arguments ?? tc.arguments) === "string"
            ? (tc.function?.arguments ?? tc.arguments ?? "{}")
            : JSON.stringify(tc.function?.arguments ?? tc.arguments ?? {}),
          status: "done",
        }));
      }

      return uiMsg;
    });
};

function formatRelativeTime(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function buildSessionPickerItems(sessions: SessionSummary[]): SelectorItem[] {
  return sessions.map((session) => {
    const role = session.lastMessageRole ?? "system";
    const roleLabel = role === "assistant" ? "assistant" : role === "user" ? "you" : "system";
    const relative = formatRelativeTime(session.updatedAt);
    return {
      label: `${session.sameProject ? "[this project] " : "[other] "}${session.id.slice(0, 15)}... | ${session.turnCount} turns | ${relative}`,
      value: session.id,
      description: `${roleLabel} · ${session.projectRoot}`,
      preview: session.lastMessageSnippet ?? "No messages yet",
      previewLines: 5,
      keywords: [session.projectRoot, roleLabel, relative, session.id],
    };
  });
}

export const App: React.FC<AppProps> = ({ agent, initialModel, initialMode, initialStreaming }) => {
  const { exit } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>(() => mapOpenAiToUiMessages(agent.getConversationHistory()));
  const [autoApprove, setAutoApprove] = useState(false);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCallEntry[]>([]);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [cmdOutput, setCmdOutput] = useState<CommandOutputEntry | null>(null);
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);

  const [model, setModel] = useState(initialModel);
  const [mode, setMode] = useState(initialMode);
  const [streaming, setStreaming] = useState(initialStreaming);
  const [workMode, setWorkMode] = useState(agent.getWorkMode());
  const [apiMode, setApiMode] = useState(agent.getApiMode());
  const [selector, setSelector] = useState<SelectorState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [connectModal, setConnectModal] = useState<ConnectModalState | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [uiState, setUiState] = useState(() => loadCliUiState(agent.getProjectRoot()));
  const [thoughtProcess, setThoughtProcess] = useState("");
  const promptHistorySnapshot = usePromptHistorySnapshot();
  const sessionSummarySnapshot = useSessionSummarySnapshot(agent.getProjectRoot());

  // Deferred values for smoother streaming interaction
  const deferredStreamBuffer = React.useDeferredValue(streamBuffer);
  const deferredThoughtProcess = React.useDeferredValue(thoughtProcess);
  const deferredMessages = React.useDeferredValue(messages);

  // Reset suggestion scroll when typing
  useEffect(() => {
    if (input.startsWith("/")) {
      const filtered = COMMANDS.filter(c => ("/" + c.cmd).startsWith(input.toLowerCase())).slice(0, 20);
      if (suggestionIndex >= filtered.length) {
        setSuggestionIndex(0);
      }
    } else {
      setSuggestionIndex(0);
    }
  }, [input]);

  useEffect(() => {
    updateTaskStatusStore(activeTools);
  }, [activeTools]);

  useEffect(() => {
    initializePromptHistoryStore(uiState.promptHistory);
  }, [uiState.promptHistory]);

  const persistUiState = useCallback((next: ReturnType<typeof loadCliUiState>) => {
    setUiState(next);
    saveCliUiState(agent.getProjectRoot(), next);
  }, [agent]);

  const promptHistory = usePromptHistory({
    entries: promptHistorySnapshot.entries,
    input,
    setInput,
  });

  const handleSelect = useCallback(async (item: { value: string }) => {
    if (!selector) {
      setSelector(null);
      return;
    }
    const val = item.value;
    const { onSelect, recentsKey } = selector;
    setSelector(null);
    if (recentsKey) {
      const next = { ...uiState, [recentsKey]: pushRecent(uiState[recentsKey], val) };
      persistUiState(next);
    }
    await onSelect(val);
  }, [selector, agent, uiState, persistUiState]);

  // ─── Slash Commands ──────────────────────────────────

  const handleCommand = useCallback(async (raw: string) => {
    const parts = raw.slice(1).split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (cmd) {
      case "quit": case "exit":
        await agent.close();
        exit();
        return;

      case "reset":
        agent.resetConversation();
        setMessages([]);
        setActiveTools([]);
        setCmdOutput({ type: "success", content: "Conversation reset." });
        return;

      case "approve":
        agent.setPlanApproved(true);
        setCmdOutput({ type: "success", content: "Plan APPROVED. Jim is now authorized to execute changes." });
        return;

      case "yolo":
        setAutoApprove(prev => {
          const next = !prev;
          if (next) {
            agent.setPlanApproved(true);
            setCmdOutput({ type: "success", content: "YOLO MODE ON. All safety checks bypassed. You only live once!" });
          } else {
            setCmdOutput({ type: "success", content: "YOLO MODE OFF. Safety checks restored." });
          }
          return next;
        });
        return;

      case "auto-approve":
        setAutoApprove(prev => {
          const next = !prev;
          setCmdOutput({ type: "success", content: `Auto-approve: ${next ? "ON" : "OFF"}` });
          return next;
        });
        return;

      case "mode":
        if (args) {
          agent.setPermissionMode(args as PermissionMode);
          setMode(args);
          setCmdOutput({ type: "success", content: `Mode: ${args}` });
        } else {
          setSelector({
            type: "choice",
            title: "Select permission mode",
            items: [
              { label: "plan", value: "plan", description: "Read-only mode: explore code without making changes" },
              { label: "edit", value: "edit", description: "Auto-approve file changes, ask for shell commands" },
              { label: "ask", value: "ask", description: "Ask for permission before modifying files or running commands" },
            ],
            onSelect(value) {
              agent.setPermissionMode(value as PermissionMode);
              setMode(value);
              setCmdOutput({ type: "success", content: `Permission mode set to: ${value}` });
            },
          });
        }
        return;

      case "learn":
        if (args) {
          await agent.learn(args);
          setCmdOutput({ type: "success", content: `Learned: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: "Usage: /learn <fact>" });
        }
        return;

      case "compact":
        agent.compactContext();
        setCmdOutput({ type: "success", content: "Context compacted." });
        return;

      case "stream":
        setStreaming(prev => {
          const next = !prev;
          setCmdOutput({ type: "success", content: `Streaming: ${next ? "ON" : "OFF"}` });
          return next;
        });
        return;

      case "ollaman":
        if (args) {
          if (args === "off" || args === "disable") {
            agent.setOllamaBackground(false);
            setCmdOutput({ type: "success", content: `Ollama background tasks DISABLED.` });
          } else {
            agent.setOllamaBackground(true, args);
            setCmdOutput({ type: "success", content: `Ollama background tasks ENABLED. Model: ${args}` });
          }
        } else {
          const config = agent.getOllamaBackgroundState();
          if (config.enabled) {
            agent.setOllamaBackground(false);
            setCmdOutput({ type: "success", content: `Ollama background tasks DISABLED.` });
          } else {
            agent.setOllamaBackground(true, config.model);
            setCmdOutput({ type: "success", content: `Ollama background tasks ENABLED. Model: ${config.model}` });
          }
        }
        return;

      case "model":
        if (args) {
          agent.setModel(args);
          setModel(args);
          setCmdOutput({ type: "success", content: `Model: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: `Current model: ${agent.getModel()}` });
        }
        return;

      case "models": {
        setCmdOutput({ type: "info", content: "Fetching models from provider..." });
        const models = await agent.fetchModels();
        setCmdOutput(null);
        setSelector({
          type: "model",
          title: "Select model",
          favoritesKey: "favoriteModels",
          recentsKey: "recentModels",
          items: models.map(m => ({ label: m, value: m, keywords: m.split(/[/:.-]/g) })),
          async onSelect(value) {
            agent.setModel(value);
            setModel(value);
            setCmdOutput({ type: "success", content: `Model switched to: ${value}` });
          },
        });
        return;
      }

      case "provider":
        if (args) {
          if (args !== "auto" && args !== "openai" && args !== "openai-compatible" && args !== "chat-completions" && args !== "responses") {
            setCmdOutput({ type: "info", content: "Usage: /provider <auto|openai|openai-compatible>" });
            return;
          }
          agent.setApiMode(args);
          setApiMode(agent.getApiMode());
          setCmdOutput({ type: "success", content: `Provider mode: ${agent.getApiMode()} (effective: ${agent.getEffectiveProvider()})` });
        } else {
          const metadata = agent.getProviderMetadata();
          const currentPreset = agent.getProviderPreset();
          setCmdOutput({
            type: "list",
            content: `Provider: ${currentPreset || "Custom"} | Adapter: ${agent.getApiMode()} (effective: ${agent.getEffectiveProvider()})`,
            items: [
              `Label: ${metadata.label}`,
              `Transport: ${metadata.transport}`,
              `Endpoint: ${metadata.endpoint}`,
              `Supports: ${metadata.supports.join(", ")}`,
              `Recommended for model: ${agent.getRecommendedProviderForModel()}`,
            ],
          });
        }
        return;

      case "adapters":
        {
          const recommended = agent.getRecommendedProviderForModel();
          const providers = agent.getProviderRegistry();
          setSelector({
            type: "provider",
            title: "Select provider adapter (Technical)",
            favoritesKey: "favoriteProviders",
            recentsKey: "recentProviders",
            items: [
              { label: "Auto (recommended)", value: "auto", description: `Picks best adapter for ${agent.getModel()}: ${recommended}`, keywords: [recommended, agent.getModel()] },
              ...providers.map((provider) => ({
                label: provider.label,
                value: provider.name,
                description: `${provider.description} · ${provider.transport}`,
                keywords: [provider.transport, ...provider.supports, provider.name],
              })),
            ],
            onSelect(value) {
              agent.setApiMode(value as any);
              setApiMode(agent.getApiMode());
              setCmdOutput({ type: "success", content: `Adapter set to: ${agent.getApiMode()} (effective: ${agent.getEffectiveProvider()})` });
            },
          });
          return;
        }

      case "providers":
      case "connections":
      case "connect":
        if (args) {
          const preset = agent.getResolvedProviderPreset(args);
          if (!preset) {
            setCmdOutput({ type: "error", content: `Unknown provider service: ${args}` });
            return;
          }
          if (!preset.adapter) {
            const result = agent.connectProviderPreset(args);
            setCmdOutput({ type: "list", content: result.message, items: result.details });
            return;
          }
          setConnectModal({
            presetId: args,
            title: `Connect ${preset.label}`,
            description: preset.description,
            fields: preset.fields.map((field) => ({
              key: field.key,
              label: field.label,
              required: field.required,
              secret: field.secret,
              placeholder: field.placeholder,
              envVar: field.envVar,
            })),
            initialValues: preset.values,
          });
          return;
        }
        {
          const presets = agent.getProviderPresets();
          setSelector({
            type: "connection",
            title: "Select provider service",
            favoritesKey: "favoriteConnections",
            recentsKey: "recentConnections",
            items: presets.map((preset) => ({
              label: preset.label,
              value: preset.id,
              description: formatProviderDescription(preset),
              keywords: [preset.label, preset.support, preset.adapter ?? "manual", preset.configured ? "configured" : "setup"],
            })),
            onSelect(value) {
              const preset = agent.getResolvedProviderPreset(value);
              if (!preset) {
                setCmdOutput({ type: "error", content: `Unknown provider: ${value}` });
                return;
              }
              if (!preset.adapter) {
                const result = agent.connectProviderPreset(value);
                setCmdOutput({ type: "list", content: result.message, items: result.details });
                return;
              }
              setConnectModal({
                presetId: value,
                title: `Connect ${preset.label}`,
                description: preset.description,
                fields: preset.fields.map((field) => ({
                  key: field.key,
                  label: field.label,
                  required: field.required,
                  secret: field.secret,
                  placeholder: field.placeholder,
                  envVar: field.envVar,
                })),
                initialValues: preset.values,
              });
            },
          });
          return;
        }

      case "workmode":
        if (args) {
          agent.setWorkMode(args as "architect" | "ask" | "code");
          setWorkMode(agent.getWorkMode());
          setCmdOutput({ type: "success", content: `Work mode: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: `Current work mode: ${agent.getWorkMode()}` });
        }
        return;

      case "modes":
        setSelector({
          type: "mode",
          title: "Select work mode",
          items: [
            { label: "architect", value: "architect", description: "Plan and compare approaches before editing" },
            { label: "ask", value: "ask", description: "Answer and diagnose with minimal mutation" },
            { label: "code", value: "code", description: "Implement changes directly" },
          ],
          onSelect(value) {
            agent.setWorkMode(value as "architect" | "ask" | "code");
            setWorkMode(agent.getWorkMode());
            setCmdOutput({ type: "success", content: `Work mode: ${value}` });
          },
        });
        return;

      case "rules": {
        const rules = agent.getMemory().getConditionalRules();
        if (rules.length === 0) {
          setCmdOutput({ type: "info", content: "No conditional rules." });
        } else {
          setCmdOutput({
            type: "list",
            content: "Conditional rules:",
            items: rules.map(r => `${r.path}: ${r.content.slice(0, 60)}...`),
          });
        }
        return;
      }

      case "sessions": {
        const sessions = sessionSummarySnapshot.sessions;
        if (sessions.length === 0) {
          setCmdOutput({ type: "info", content: "No saved sessions." });
        } else {
          setSelector({
            type: "session",
            title: "Select session (this project first)",
            items: buildSessionPickerItems(sessions),
            async onSelect(value) {
              const ok = await agent.loadSession(value);
              setMode(agent.getPermissionMode());
              setWorkMode(agent.getWorkMode());
              setApiMode(agent.getApiMode());
              setMessages(mapOpenAiToUiMessages(agent.getConversationHistory()));
              setCmdOutput({ type: ok ? "success" : "error", content: ok ? `Session loaded: ${value}` : `Failed to load: ${value}` });
            },
          });
        }
        return;
      }

      case "checkpoint":
        if (!args) {
          setCmdOutput({ type: "info", content: "Usage: /checkpoint <label>" });
          return;
        }
        await agent.createCheckpoint(args);
        setCmdOutput({ type: "success", content: `Checkpoint created: ${args}` });
        return;

      case "checkpoints": {
        const checkpoints = await agent.listCheckpoints();
        if (checkpoints.length === 0) {
          setCmdOutput({ type: "info", content: "No checkpoints." });
        } else {
          setSelector({
            type: "checkpoint",
            title: "Restore checkpoint",
            items: checkpoints.map(cp => ({
              label: `${cp.label} | turn ${cp.turnCount} | ${new Date(cp.createdAt).toLocaleTimeString()}`,
              value: cp.id,
            })),
            async onSelect(value) {
              const restored = await agent.restoreCheckpoint(value);
              setMode(agent.getPermissionMode());
              setWorkMode(agent.getWorkMode());
              setApiMode(agent.getApiMode());
              setMessages(mapOpenAiToUiMessages(agent.getConversationHistory()));
              setCmdOutput({ type: restored ? "success" : "error", content: restored ? `Checkpoint restored: ${value}` : `Failed to restore checkpoint: ${value}` });
            },
          });
        }
        return;
      }

      case "restore":
        if (!args) {
          setCmdOutput({ type: "info", content: "Usage: /restore <checkpoint-id>" });
          return;
        }
        {
          const restored = await agent.restoreCheckpoint(args);
          setMode(agent.getPermissionMode());
          setWorkMode(agent.getWorkMode());
          setApiMode(agent.getApiMode());
          setMessages(mapOpenAiToUiMessages(agent.getConversationHistory()));
          setCmdOutput({
            type: restored ? "success" : "error",
            content: restored ? `Checkpoint restored: ${args}` : `Failed to restore checkpoint: ${args}`,
          });
        }
        return;

      case "load":
        if (args) {
          const ok = await agent.loadSession(args);
          if (ok) {
            setMode(agent.getPermissionMode());
            setWorkMode(agent.getWorkMode());
            setApiMode(agent.getApiMode());
            setMessages(mapOpenAiToUiMessages(agent.getConversationHistory()));
          }
          setCmdOutput({ type: ok ? "success" : "error", content: ok ? `Session loaded: ${args}` : `Not found: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: "Usage: /load <session-id>" });
        }
        return;

      case "delete":
        if (args) {
          const ok = await agent.deleteSession(args);
          setCmdOutput({ type: ok ? "success" : "error", content: ok ? `Deleted: ${args}` : `Not found: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: "Usage: /delete <session-id>" });
        }
        return;

      case "history":
        if (args === "search") {
          if (promptHistorySnapshot.entries.length === 0) {
            setCmdOutput({ type: "info", content: "Prompt history is empty." });
            return;
          }
          setSelector({
            type: "history",
            title: "Search prompt history",
            recents: promptHistorySnapshot.entries,
            items: promptHistorySnapshot.entries.map((entry, index) => ({
              label: entry.split("\n")[0] || entry,
              value: entry,
              description: index === 0 ? "Latest prompt" : `${index + 1} prompts ago`,
              keywords: entry.split(/\s+/g).slice(0, 12),
              preview: entry,
              previewLines: 6,
            })),
            onSelect(value) {
              promptHistory.reset();
              setInput(value);
              setCmdOutput({ type: "info", content: "Prompt restored from history." });
            },
          });
          return;
        }
        setCmdOutput({
          type: "info",
          content: `Messages: ${agent.getConversationHistory().length} | Turn: ${agent.getTurnCount()} | Session: ${agent.getSessionId()} | Prompt history: ${promptHistorySnapshot.entries.length}`,
        });
        return;

      case "config":
        setShowConfig(true);
        return;

      case "hooks": {
        const list = agent.getHooks().list();
        if (list.length === 0) {
          setCmdOutput({ type: "info", content: "No hooks." });
        } else {
          setCmdOutput({
            type: "list",
            content: "Hooks:",
            items: list.map(h => `[${h.event}] ${h.description ?? h.command}`),
          });
        }
        return;
      }

      case "memory": {
        const layers = agent.getMemory().getLayers();
        if (layers.length === 0) {
          setCmdOutput({ type: "info", content: "No memory layers." });
        } else {
          setCmdOutput({
            type: "list",
            content: "Memory:",
            items: layers.map(l => `[${l.scope}] ${l.path}: ${l.content.slice(0, 60)}...`),
          });
        }
        return;
      }

      case "doctor": {
        setCmdOutput({ type: "info", content: "Running diagnostics..." });
        try {
          const social = await agent.runTool("social_doctor");
          const office = await agent.runTool("office_doctor");
          const out = `${social?.content ?? ""}\n\n${office?.content ?? ""}`;
          setCmdOutput({ type: "info", content: out.slice(0, 12000) });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setCmdOutput({ type: "error", content: `Doctor failed: ${msg}` });
        }
        return;
      }

      case "mcp": {
        try {
          const res = await handleMcpCommand(agent, args);
          if (res.type === "list") setCmdOutput({ type: "list", content: res.content, items: res.items });
          else if (res.type === "info") setCmdOutput({ type: "info", content: res.content });
          else if (res.type === "success") setCmdOutput({ type: "success", content: res.content });
          else setCmdOutput({ type: "error", content: res.content });
        } catch (err) {
          setCmdOutput({ type: "error", content: `/mcp failed: ${String(err)}` });
        }
        return;
      }

      case "tool-results": {
        setCmdOutput({ type: "info", content: "Fetching persisted tool results..." });
        const list = await agent.listToolResults();
        if (Array.isArray(list)) {
          if (list.length === 0) {
            setCmdOutput({ type: "info", content: "No persisted tool results." });
          } else {
            setCmdOutput({ type: "list", content: `Persisted tool results (${list.length})`, items: list.map(l => `${l.reference} | ${l.toolName} | ${formatBytes(l.size)} | ${new Date(l.timestamp).toLocaleString()}`) });
          }
        } else {
          setCmdOutput({ type: "info", content: `Persisted tool results summary: ${list.totalResults ?? 0}` });
        }
        return;
      }

      case "tool-retrieve": {
        if (!args) {
          setCmdOutput({ type: "info", content: "Usage: /tool-retrieve <tool-result://...>" });
          return;
        }
        setCmdOutput({ type: "info", content: `Retrieving ${args}...` });
        const text = await agent.retrieveToolResult(args);
        if (!text) {
          setCmdOutput({ type: "error", content: `Could not retrieve: ${args}` });
        } else {
          setCmdOutput({ type: "info", content: text.slice(0, 8000) });
        }
        return;
      }

      case "session-memory": {
        const entries = agent.getSessionMemories(200);
        if (!entries || entries.length === 0) {
          setCmdOutput({ type: "info", content: "No session memory items." });
        } else {
          const q = args?.toLowerCase?.() ?? "";
          const filtered = q ? entries.filter(e => e.content.toLowerCase().includes(q) || (e.tags ?? []).some(t => t.includes(q))) : entries;
          setCmdOutput({ type: "list", content: `Session memory (${filtered.length})`, items: filtered.map(m => `${m.id} | ${m.type} | ${m.tags?.join(",") ?? ""} | ${m.content.slice(0, 120).replace(/\n/g, " ")}`) });
        }
        return;
      }

      case "help":
        setCmdOutput({
          type: "list",
          content: "Commands:",
          items: [
            "/reset            Clear conversation",
            "/mode <mode>      Permission mode",
            "/auto-approve     Toggle auto-approve",
            "/learn <fact>     Save to memory",
            "/compact          Compact context",
            "/stream           Toggle streaming",
            "/model [name]     Show/switch model",
            "/models           List models",
            "/provider [name]  Show/switch current service",
            "/providers        Pick a provider service (OpenCode, OpenRouter, etc.)",
            "/adapters         Pick a technical provider adapter (OpenAI, etc.)",
            "/connect [id]     Connect a service by ID",
            "/connections      List all available provider services",
            "/workmode [name]  Show/switch architect|ask|code",
            "/modes            Pick a work mode",
            "/rules            Show rules",
            "/sessions         List sessions",
            "/load <id>        Load session",
            "/delete <id>      Delete session",
            "/checkpoint <lbl> Save a checkpoint",
            "/checkpoints      Browse checkpoints",
            "/restore <id>     Restore checkpoint",
            "/themes           Pick a UI color theme",
            "/plugins          Browse plugin catalog",
            "/doctor           Run diagnostics (social + office checks)",
            "/tool-results     List persisted tool outputs",
            "/tool-retrieve <ref>  Retrieve persisted tool output by reference",
            "/session-memory [query]   Show session memory items (optional query)",
            "/hooks            List hooks",
            "/memory           Show memory",
            "/config           Show config",
            "/stats            Show usage statistics",
            "/history          Message stats",
            "/history search   Search prompt history",
            "/approve          APPROVE the current plan",
            "/yolo             Toggle YOLO mode (bypass all safety)",
            "/ollaman [model]  Toggle background Ollaman",
            "/help             This help",
            "/quit             Exit",
          ],
        });
        return;
      
      case "stats":
        setShowStats(true);
        return;

      case "themes":
        setSelector({
          type: "mode",
          title: "Select UI Theme",
          items: THEME_LIST.map(t => ({ label: t.label, value: t.id, description: t.id })),
          onSelect(value) {
            setTheme(value);
            const next = { ...uiState, themeId: value };
            persistUiState(next);
            setCmdOutput({ type: "success", content: `Theme switched to: ${value}. Restart Jim if colors don't refresh immediately.` });
          },
        });
        return;

      case "plugins": {
        const plugins = agent.getPluginCatalog();
        setSelector({
          type: "plugin",
          title: "Select plugin group",
          items: plugins.map((plugin) => ({
            label: `${plugin.name} | ${plugin.type} | ${plugin.toolCount} tools${plugin.healthy === false ? " | offline" : ""}`,
            value: plugin.name,
            description: plugin.tools.slice(0, 6).join(", "),
          })),
          onSelect(value) {
            const plugin = agent.getPluginCatalog().find((entry) => entry.name === value);
            if (!plugin) {
              setCmdOutput({ type: "error", content: `Plugin not found: ${value}` });
              return;
            }
            setCmdOutput({
              type: "list",
              content: `Plugin: ${plugin.name} (${plugin.type})`,
              items: plugin.tools.map((tool) => tool),
            });
          },
        });
        return;
      }

      default:
        setCmdOutput({ type: "error", content: `Unknown command: /${cmd}` });
    }
  }, [agent, exit, mode, streaming, workMode, apiMode, promptHistory, promptHistorySnapshot.entries, sessionSummarySnapshot.sessions]);

  // ─── Agent Run ───────────────────────────────────────

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;

    const nextUiState = {
      ...uiState,
      promptHistory: pushPromptHistoryStore(trimmed),
    };
    persistUiState(nextUiState);
    promptHistory.reset();
    setInput("");
    setCmdOutput(null);

    // Slash command
    if (trimmed.startsWith("/")) {
      await handleCommand(trimmed);
      return;
    }

    // Add user message
    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setIsProcessing(true);
    setStartTime(Date.now());
    setActiveTools([]);
    setStreamBuffer("");

    setThoughtProcess("");

    const callbacks: AgentCallbacks = {
      onThinking(content) {
        if (content && content !== "[Compacting context...]" && content !== "[Rate limited, waiting 5s...]" && content !== "[Generating repository map...]") {
          setThoughtProcess(prev => prev ? prev + "\n" + content : content);
        }
      },
      onStreamChunk(chunk) {
        setStreamBuffer(prev => prev + chunk);
        setThoughtProcess(prev => prev + chunk);
      },
      onToolCall(name, args) {
        const argStr = Object.entries(args)
          .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60)}`)
          .join(" ");

        setActiveTools(prev => [...prev, { name, args: argStr, status: "running" }]);
      },
      onToolResult(name, content, isError, diff) {
        setActiveTools(prev =>
          prev.map(t =>
            t.name === name && t.status !== "done" && t.status !== "error"
              ? { ...t, status: isError ? "error" : "done", result: content.slice(0, 120).replace(/\n/g, " "), rawResult: content, diff }
              : t
          )
        );
      },
      onError(error) {
        setMessages(prev => [...prev, { role: "system", content: `Error: ${error}` }]);
      },
      async onPermissionRequest(toolName, args, diffPreview) {
        if (autoApprove) return true;
        return new Promise<boolean>((resolve) => {
          setActiveTools(prev =>
            prev.map(t =>
              t.name === toolName && t.status === "running"
                ? { ...t, status: "pending_approval" }
                : t
            )
          );
          setPermRequest({
            toolName,
            args: JSON.stringify(args).slice(0, 100),
            diffPreview: diffPreview ?? undefined,
            resolve,
          });
        });
      },
      async onChoiceRequest(prompt, choices) {
        return new Promise<string>((resolve) => {
          setActiveTools(prev =>
            prev.map(t =>
              t.name === "ask_user_choice" && t.status === "running"
                ? { ...t, status: "awaiting_choice", result: prompt }
                : t
            )
          );
          setSelector({
            type: "choice",
            title: prompt,
            items: choices,
            onSelect(value) {
              resolve(value);
              setCmdOutput({ type: "success", content: `Selected: ${value}` });
            },
          });
        });
      },
      onMemoryLoaded(count) {
        if (count > 0) {
          setMessages(prev => [...prev, { role: "system", content: `Loaded ${count} memory layers` }]);
        }
      },
      onHookFired(event, output) {
        setMessages(prev => [...prev, { role: "system", content: `Hook [${event}]: ${output}` }]);
      },
      onSessionSaved() {
        // silent
      },
    };

    try {
      const response = await agent.run(trimmed, callbacks);

      // Finalize tools into the user's message
      setActiveTools(current => {
        if (current.length > 0) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === "user") {
              return [...prev.slice(0, -1), { ...last, toolCalls: current }];
            }
            return prev;
          });
        }
        return [];
      });

      // Add assistant response
      if (response && !response.startsWith("Error:")) {
        if (!streaming) {
          // Hacker Typewriter Effect
          setStreamBuffer("");
          const chunkSize = 3;
          for (let i = 0; i < response.length; i += chunkSize) {
            setStreamBuffer(prev => prev + response.slice(i, i + chunkSize));
            await new Promise(r => setTimeout(r, 25)); // Smooth terminal typewriter speed
          }
        }
        setMessages(prev => [...prev, { role: "assistant", content: response }]);
      } else if (response?.startsWith("Error:")) {
        setMessages(prev => [...prev, { role: "system", content: response }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: "system", content: `Unexpected: ${msg}` }]);
    } finally {
      setIsProcessing(false);
      setStartTime(null);
      setStreamBuffer("");
      setThoughtProcess("");
    }
  }, [agent, isProcessing, handleCommand, persistUiState, promptHistory, streaming, streamBuffer, uiState]);

  // ─── Permission input ────────────────────────────────

  const handlePermission = useCallback((approved: boolean) => {
    permRequest?.resolve(approved);
    setActiveTools(prev =>
      prev.map(t =>
        permRequest && t.name === permRequest.toolName && t.status === "pending_approval"
          ? { ...t, status: approved ? "running" : "error", result: approved ? "approval granted" : "approval denied" }
          : t
      )
    );
    setPermRequest(null);
  }, [permRequest]);

  // Use virtual scroll for the main list - keep last 50 messages
  const virtualHistory = useVirtualScroll(deferredMessages, 50);
  const displayMessages = virtualHistory.items;

  // ─── Ctrl+C ──────────────────────────────────────────

  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      void agent.close().finally(() => exit());
    }

    if (key.ctrl && _input === "r" && !permRequest && !selector && !connectModal && !showConfig && !showStats && !isProcessing) {
      if (promptHistorySnapshot.entries.length === 0) {
        setCmdOutput({ type: "info", content: "Prompt history is empty." });
        return;
      }

      setSelector({
        type: "history",
        title: "Search prompt history",
        recents: promptHistorySnapshot.entries,
        items: promptHistorySnapshot.entries.map((entry, index) => ({
          label: entry.split("\n")[0] || entry,
          value: entry,
          description: index === 0 ? "Latest prompt" : `${index + 1} prompts ago`,
          keywords: entry.split(/\s+/g).slice(0, 12),
          preview: entry,
          previewLines: 6,
        })),
        onSelect(value) {
          promptHistory.reset();
          setInput(value);
          setCmdOutput({ type: "info", content: "Prompt restored from history." });
        },
      });
      return;
    }

    if (!permRequest && !selector && !connectModal && !showConfig && !showStats && !isProcessing) {
      const parts = input.split(" ");
      let suggestionCount = 0;
      if (input.startsWith("/")) {
        if (parts.length === 1) {
          suggestionCount = COMMANDS.filter(c => ("/" + c.cmd).startsWith(input.toLowerCase())).slice(0, 5).length;
        } else if (parts.length === 2) {
          const cmd = parts[0].toLowerCase();
          const argPrefix = parts[1].toLowerCase();

          if (cmd === "/mode") {
            suggestionCount = ["plan", "edit", "ask"].filter(m => m.startsWith(argPrefix)).length;
          } else if (cmd === "/workmode") {
            suggestionCount = ["architect", "ask", "code"].filter(m => m.startsWith(argPrefix)).length;
          } else if (cmd === "/api" || cmd === "/provider") {
            suggestionCount = ["auto", "openai", "openai-compatible"].filter(m => m.startsWith(argPrefix)).length;
          }
        }
      }

      if (suggestionCount === 0) {
        if (key.upArrow && promptHistory.navigateUp()) {
          return;
        }
        if (key.downArrow && promptHistory.navigateDown()) {
          return;
        }
      }
    }

    // Command/Arg suggestion navigation
    if (input.startsWith("/")) {
      const parts = input.split(" ");
      let suggestions: { label: string; value: string; desc?: string }[] = [];
      
      if (parts.length === 1) {
        // Command suggestions
        const filtered = COMMANDS.filter(c => ("/" + c.cmd).startsWith(input.toLowerCase())).slice(0, 5);
        suggestions = filtered.map(c => ({ label: "/" + c.cmd, value: "/" + c.cmd + " ", desc: c.desc }));
      } else if (parts.length === 2) {
        // Argument suggestions
        const cmd = parts[0].toLowerCase();
        const argPrefix = parts[1].toLowerCase();
        
        if (cmd === "/mode") {
          const modes = ["plan", "edit", "ask"];
          suggestions = modes.filter(m => m.startsWith(argPrefix)).map(m => ({ label: m, value: "/mode " + m }));
        } else if (cmd === "/workmode") {
          const wmodes = ["architect", "ask", "code"];
          suggestions = wmodes.filter(m => m.startsWith(argPrefix)).map(m => ({ label: m, value: "/workmode " + m }));
        } else if (cmd === "/api" || cmd === "/provider") {
          const amodes = ["auto", "openai", "openai-compatible"];
          suggestions = amodes.filter(m => m.startsWith(argPrefix)).map(m => ({ label: m, value: cmd + " " + m }));
        }
      }

      if (suggestions.length > 0) {
        const safeIndex = Math.min(suggestionIndex, suggestions.length - 1);
        if (key.downArrow) {
          setSuggestionIndex(prev => (prev + 1) % suggestions.length);
        } else if (key.upArrow) {
          setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (key.tab || (key.return && suggestionIndex >= 0)) {
           const selected = suggestions[safeIndex];
           if (selected) {
             setInput(selected.value);
             setSuggestionIndex(0);
           }
        }
      }
    }
  });

  const pickerFavorites = selector?.favoritesKey ? uiState[selector.favoritesKey] : [];
  const pickerRecents = selector?.recentsKey ? uiState[selector.recentsKey] : (selector?.recents ?? []);
  const selectorItems = selector?.type === "session"
    ? buildSessionPickerItems(sessionSummarySnapshot.sessions)
    : (selector?.items as SearchablePickerItem[] | undefined);

  // ─── Render ──────────────────────────────────────────

  const liveTokens = agent.getEstimatedTokens() + Math.floor(deferredStreamBuffer.length / 4);

  return (
    <Box flexDirection="column" padding={1}>
      <Header 
        model={model} 
        mode={mode} 
        workMode={workMode}
        streaming={streaming} 
        tokens={liveTokens} 
        projectRoot={agent.getProjectRoot()}
        username={process.env.USER || process.env.USERNAME || "Engineer"}
        yolo={autoApprove}
      />

      {/* Messages */}
      {displayMessages.map((msg, i) => (
        <Box key={i} flexDirection="column">
          <Message role={msg.role} content={msg.content} />
          {msg.toolCalls && <ToolActivity calls={msg.toolCalls} />}
        </Box>
      ))}
 
      {/* Active tool calls (while processing) */}
      {isProcessing && activeTools.length > 0 && (
        <ToolActivity calls={activeTools} />
      )}
 
      {/* Thought process (faded gray) - show when streaming or thinking */}
      {isProcessing && deferredThoughtProcess && !permRequest && (
        <ThoughtProcess
          content={deferredThoughtProcess}
          isStreaming={streaming && activeTools.length === 0}
          elapsed={startTime ? Math.floor((Date.now() - startTime) / 1000) : 0}
          tokens={liveTokens}
        />
      )}

      {/* Thinking animation - fallback when no thought process yet */}
      {isProcessing && !thoughtProcess && activeTools.every(t => t.status === "done" || t.status === "error") && (
        <ThinkingAnimation tokens={liveTokens} startTime={startTime ?? undefined} />
      )}

      {/* Stats View Overlay */}
      {showStats && (
        <StatsView 
          projectRoot={agent.getProjectRoot()} 
          onClose={() => setShowStats(false)} 
        />
      )}

      {/* Config View Overlay */}
      {showConfig && (
        <ConfigView 
          onClose={() => setShowConfig(false)}
          onUpdate={(key, val) => {
            if (key === "model") { agent.setModel(val); setModel(val); }
            if (key === "streaming") { setStreaming(val); }
            if (key === "mode") { agent.setPermissionMode(val); setMode(val); }
            if (key === "workMode") { agent.setWorkMode(val); setWorkMode(val); }
            if (key === "api") { agent.setApiMode(val); setApiMode(val); }
            setCmdOutput({ type: "success", content: `Config updated: ${key} = ${val}` });
          }}
          config={[
            { key: "model", label: "Model", value: model, type: "enum", options: agent.getAvailableModels() },
            { key: "streaming", label: "Streaming", value: streaming, type: "boolean" },
            { key: "mode", label: "Permission mode", value: mode, type: "enum", options: ["plan", "edit", "ask"] },
            { key: "workMode", label: "Work mode", value: workMode, type: "enum", options: ["architect", "ask", "code"] },
            { key: "api", label: "Provider mode", value: apiMode, type: "enum", options: ["auto", "openai", "openai-compatible"] },
            { key: "baseUrl", label: "Base URL", value: agent.getBaseUrl(), type: "string" },
          ]}
          status={{
            nodeVersion: process.version,
            platform: process.platform,
            uptime: formatDuration(Date.now() - (startTime ?? Date.now())),
            memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            projectRoot: agent.getProjectRoot(),
            provider: agent.getProviderPreset() ?? "default",
            adapter: apiMode,
          }}
          usage={{
            tokens: liveTokens,
            messages: messages.length,
            turns: messages.filter(m => m.role === "user").length,
            sessionDuration: startTime ? formatDuration(Date.now() - startTime) : "0m",
            model,
          }}
        />
      )}

      {/* Streaming buffer - hidden when thought process is active */}
      {streaming && deferredStreamBuffer && isProcessing && !deferredThoughtProcess && (
        <Box marginTop={1} flexDirection="row">
          <Box flexDirection="column" marginRight={1}>
            <Text color={theme.secondary}>▌</Text>
          </Box>
          <Box flexDirection="column" flexShrink={1}>
            <Text>{deferredStreamBuffer}</Text>
          </Box>
        </Box>
      )}

      {/* Command output */}
      <CommandOutput output={cmdOutput} />

      {/* Plan approval prompt */}
      {!agent.isPlanApproved() && activeTools.some(t => t.name === "todo_write" && t.status === "done") && (
        <Box borderStyle="double" borderColor={theme.warning} padding={1} marginY={1}>
          <Text bold color={theme.warning}>PLAN PENDING APPROVAL</Text>
          <Text> Review the plan above. If it looks good, type </Text>
          <Text color={theme.primary} bold>/approve</Text>
          <Text> to authorize Jim.</Text>
        </Box>
      )}

      {/* Permission prompt */}
      {permRequest && (
        <PermissionPrompt
          toolName={permRequest.toolName}
          args={permRequest.args}
          diffPreview={permRequest.diffPreview}
          onResolve={handlePermission}
        />
      )}

      {/* Status */}
      <StatusBar
        turn={agent.getTurnCount()}
        messageCount={agent.getConversationHistory().length}
        sessionId={agent.getSessionId()}
      />
      <StatusInfo
        turn={agent.getTurnCount()}
        messageCount={agent.getConversationHistory().length}
        sessionId={agent.getSessionId()}
      />

      {/* Suggestion overlay */}
      {input.startsWith("/") && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {(() => {
            const parts = input.split(" ");
            let suggestions: { label: string; desc?: string }[] = [];
            
            if (parts.length === 1) {
              suggestions = COMMANDS.filter(c => ("/" + c.cmd).startsWith(input.toLowerCase()))
                .slice(0, 5).map(c => ({ label: "/" + c.cmd, desc: c.desc }));
            } else if (parts.length === 2) {
              const cmd = parts[0].toLowerCase();
              const arg = parts[1].toLowerCase();
              if (cmd === "/mode") suggestions = ["plan", "edit", "ask"].filter(m => m.startsWith(arg)).map(m => ({ label: m }));
              if (cmd === "/workmode") suggestions = ["architect", "ask", "code"].filter(m => m.startsWith(arg)).map(m => ({ label: m }));
              if (cmd === "/api" || cmd === "/provider") suggestions = ["auto", "openai", "openai-compatible"].filter(m => m.startsWith(arg)).map(m => ({ label: m }));
            }

            return suggestions.map((s, i) => {
              const isSelected = i === suggestionIndex;
              return (
                <Box key={i} backgroundColor={isSelected ? theme.primary : undefined}>
                  <Text color={isSelected ? theme.inverse : theme.primary} bold={isSelected}> {isSelected ? "❯" : " "}</Text>
                  <Text color={isSelected ? theme.inverse : theme.primary} bold> {s.label.padEnd(s.desc ? 12 : 0)}</Text>
                  {s.desc && <Text color={isSelected ? theme.inverse : theme.border}> {s.desc}</Text>}
                </Box>
              );
            });
          })()}
        </Box>
      )}

      {/* Interactive Selector */}
      {selector && (
        <SearchablePicker
          title={selector.title}
          items={selectorItems ?? []}
          favorites={pickerFavorites}
          recents={pickerRecents}
          onCancel={() => setSelector(null)}
          onSelect={(value) => handleSelect({ value })}
          onToggleFavorite={selector.favoritesKey
            ? (value) => {
              const fKey = selector.favoritesKey!;
              const next: typeof uiState = { ...uiState };
              (next as any)[fKey] = toggleFavorite((uiState as any)[fKey], value);
              persistUiState(next);
            }
            : undefined}
        />
      )}

      {connectModal && (
        <ConnectModal
          title={connectModal.title}
          description={connectModal.description}
          fields={connectModal.fields}
          initialValues={connectModal.initialValues}
          onCancel={() => setConnectModal(null)}
          onSubmit={(values) => {
            const result = agent.connectProviderPreset(connectModal.presetId, values);
            setApiMode(agent.getApiMode());
            setConnectModal(null);
            const next: typeof uiState = {
              ...uiState,
              recentConnections: pushRecent(uiState.recentConnections, connectModal!.presetId),
            };
            persistUiState(next);
            setCmdOutput(result.details
              ? { type: "list", content: result.message, items: result.details }
              : { type: result.ok ? "success" : "error", content: result.message });
          }}
        />
      )}

      {/* Input */}
      {!permRequest && !selector && !connectModal && (
        <Box marginTop={0}>
          <Text bold color={theme.warning}>❯ </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={isProcessing ? "" : "ask jim anything..."}
          />
        </Box>
      )}
      {!permRequest && !selector && !connectModal && !showConfig && !showStats && !isProcessing && promptHistorySnapshot.entries.length > 0 && !input.startsWith("/") && (
        <Box marginLeft={2}>
          <Text dimColor>↑/↓ history · ctrl+r search · {promptHistorySnapshot.entries[0]}</Text>
        </Box>
      )}
      {!permRequest && !selector && !connectModal && !showConfig && !showStats && !isProcessing && sessionSummarySnapshot.latestSameProject && agent.getTurnCount() === 0 && (
        <Box marginLeft={2}>
          <Text dimColor>
            resume hint · {sessionSummarySnapshot.latestSameProject.id.slice(0, 14)}... · {sessionSummarySnapshot.latestSameProject.turnCount} turns · {formatRelativeTime(sessionSummarySnapshot.latestSameProject.updatedAt)}
          </Text>
        </Box>
      )}
    </Box>
  );
};
