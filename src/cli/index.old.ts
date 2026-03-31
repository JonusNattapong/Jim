import "dotenv/config";
import { createInterface } from "node:readline";
import { Agent } from "../agent/index.js";
import type { AgentConfig, AgentCallbacks } from "../agent/index.js";
import type { PermissionMode } from "../permissions/manager.js";

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
};

let streamingEnabled = false;

function loadConfig(): AgentConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`${c.red}Error: OPENAI_API_KEY not set.${c.reset}\n  export OPENAI_API_KEY=sk-...\n  export OPENAI_MODEL=gpt-4o`);
    process.exit(1);
  }
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    maxTurns: parseInt(process.env.MAX_TURNS ?? "25", 10),
    maxToolOutput: parseInt(process.env.MAX_TOOL_OUTPUT ?? "5000", 10),
    projectRoot: process.cwd(),
    permissionMode: (process.env.PERMISSION_MODE as PermissionMode) ?? "default",
    streaming: streamingEnabled,
  };
}

function createCallbacks(): AgentCallbacks {
  return {
    onThinking(content) {
      if (content) console.log(`\n${c.green}${c.bold}Agent:${c.reset} ${content}\n`);
    },
    onStreamChunk(chunk) {
      process.stdout.write(chunk);
    },
    onToolCall(name, args) {
      const argStr = Object.entries(args)
        .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 80) : JSON.stringify(v)}`)
        .join(", ");
      console.log(`\n${c.cyan}  ${c.dim}[${name}]${c.reset} ${argStr}`);
    },
    onToolResult(name, content, isError) {
      const color = isError ? c.red : c.dim;
      const preview = content.slice(0, 200).replace(/\n/g, " ");
      console.log(`${color}  → ${preview}${content.length > 200 ? "..." : ""}${c.reset}`);
    },
    onError(error) {
      console.error(`${c.red}Error: ${error}${c.reset}`);
    },
    async onPermissionRequest(toolName, args) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((resolve) => {
        rl.question(`${c.yellow}Allow ${c.bold}${toolName}${c.reset}${c.yellow}(${JSON.stringify(args).slice(0,100)})? [y/N]:${c.reset} `, (a) => {
          rl.close();
          resolve(a.trim().toLowerCase() === "y");
        });
      });
    },
    onMemoryLoaded(count) {
      if (count > 0) console.log(`${c.dim}  Loaded ${count} memory layers${c.reset}`);
    },
    onHookFired(event, output) {
      console.log(`${c.magenta}  Hook [${event}]: ${output}${c.reset}`);
    },
    onSessionSaved(sessionId) {
      console.log(`${c.dim}  Session saved: ${sessionId}${c.reset}`);
    },
  };
}

function printBanner(config: AgentConfig): void {
  const streamLabel = streamingEnabled ? "streaming" : "batch";
  console.log(`
${c.cyan}${c.bold}
    ╔══════════════════════════════════════════╗
    ║       🤖 Jim Coding Agent v0.4           ║
    ║  13 Tools • Multi-model • Rules • Perms  ║
    ╚══════════════════════════════════════════╝
${c.reset}
${c.dim}Model: ${config.model} | Mode: ${config.permissionMode ?? "default"} | ${streamLabel}
${c.reset}${c.dim}Commands: /reset /model /rules /compact /stream /help /quit
${c.reset}`);
}

function printHelp(): void {
  console.log(`
${c.bold}Commands:${c.reset}
  /reset              Clear conversation history
  /mode <mode>        Permission mode: plan, default, acceptEdits, dontAsk
  /learn <fact>       Save fact to MEMORY.md
  /compact            Manual context compaction
  /stream             Toggle streaming mode on/off
  /model [name]       Show or switch model (Kilo Gateway)
  /models             List available models
  /rules              Show conditional rules (.claude/rules/)
  /sessions           List saved sessions
  /load <id>          Load a saved session
  /delete <id>        Delete a saved session
  /hooks              List loaded hooks
  /memory             Show memory layers
  /config             Show configuration
  /history            Message count
  /help               This help
  /quit               Exit

${c.bold}Permission Modes:${c.reset}
  plan                Read-only
  default             Ask before modifications
  acceptEdits         Auto-approve edits, ask shell
  dontAsk             Auto-approve everything

${c.bold}Tools (13 total):${c.reset}
  read_file, edit_file, write_file, list_files
  grep, run_command, git_command, get_project_info
  todo_write, web_fetch, web_search, spawn_agent
`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const agent = new Agent(config);

  console.log(`${c.dim}Initializing...${c.reset}`);
  const callbacks = createCallbacks();
  await agent.init(callbacks);

  printBanner(config);

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const ask = (): Promise<string> =>
    new Promise((resolve) => rl.question(`${c.yellow}${c.bold}You:${c.reset} `, (a) => resolve(a.trim())));

  while (true) {
    try {
      const input = await ask();
      if (!input) continue;

      if (input.startsWith("/")) {
        const parts = input.slice(1).split(" ");
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(" ");

        switch (cmd) {
          case "quit": case "exit":
            console.log(`${c.dim}Goodbye!${c.reset}`);
            rl.close();
            process.exit(0);
          case "reset":
            agent.resetConversation();
            console.log(`${c.green}Conversation reset.${c.reset}\n`);
            continue;
          case "mode":
            if (args) { agent.setPermissionMode(args as PermissionMode); console.log(`${c.green}Mode: ${args}${c.reset}\n`); }
            else console.log(`${c.yellow}Usage: /mode <plan|default|acceptEdits|dontAsk>${c.reset}\n`);
            continue;
          case "learn":
            if (args) { await agent.learn(args); console.log(`${c.green}Learned: ${args}${c.reset}\n`); }
            else console.log(`${c.yellow}Usage: /learn <fact>${c.reset}\n`);
            continue;
          case "compact":
            agent.compactContext();
            console.log(`${c.green}Context compacted.${c.reset}\n`);
            continue;
          case "stream":
            streamingEnabled = !streamingEnabled;
            console.log(`${c.green}Streaming: ${streamingEnabled ? "ON" : "OFF"}${c.reset}\n`);
            continue;
          case "model":
            if (args) {
              agent.setModel(args);
              console.log(`${c.green}Model switched to: ${args}${c.reset}\n`);
            } else {
              console.log(`${c.dim}Current model: ${agent.getModel()}${c.reset}\n`);
            }
            continue;
          case "models": {
            const models = agent.getAvailableModels();
            const current = agent.getModel();
            console.log(`${c.bold}Available models:${c.reset}`);
            for (const m of models) {
              const marker = m === current ? `${c.green} ← current${c.reset}` : "";
              console.log(`  ${c.dim}${m}${marker}${c.reset}`);
            }
            console.log();
            continue;
          }
          case "rules": {
            const rules = agent.getMemory().getConditionalRules();
            if (rules.length === 0) {
              console.log(`${c.dim}No conditional rules. Create .claude/rules/*.md to add.${c.reset}\n`);
            } else {
              for (const r of rules) {
                const globs = r.globs ? ` (globs: ${r.globs.join(", ")})` : "";
                const preview = r.content.slice(0, 80).replace(/\n/g, " ");
                console.log(`${c.dim}  ${r.path}${globs}${c.reset}`);
                console.log(`${c.dim}    ${preview}...${c.reset}`);
              }
              console.log();
            }
            continue;
          }
          case "sessions": {
            const sessions = await agent.listSessions();
            if (sessions.length === 0) {
              console.log(`${c.dim}No saved sessions.${c.reset}\n`);
            } else {
              for (const s of sessions) {
                const ago = new Date(s.updatedAt).toLocaleString();
                console.log(`${c.dim}  ${s.id} | ${s.turnCount} turns | ${ago}${c.reset}`);
              }
              console.log();
            }
            continue;
          }
          case "load":
            if (args) {
              const ok = await agent.loadSession(args);
              if (ok) console.log(`${c.green}Session loaded: ${args}${c.reset}\n`);
              else console.log(`${c.red}Session not found: ${args}${c.reset}\n`);
            } else console.log(`${c.yellow}Usage: /load <session-id>${c.reset}\n`);
            continue;
          case "delete":
            if (args) {
              const ok = await agent.deleteSession(args);
              if (ok) console.log(`${c.green}Session deleted: ${args}${c.reset}\n`);
              else console.log(`${c.red}Session not found: ${args}${c.reset}\n`);
            } else console.log(`${c.yellow}Usage: /delete <session-id>${c.reset}\n`);
            continue;
          case "help": printHelp(); continue;
          case "history":
            console.log(`${c.dim}Messages: ${agent.getConversationHistory().length} | Turn: ${agent.getTurnCount()} | Session: ${agent.getSessionId()}${c.reset}\n`);
            continue;
          case "config":
            console.log(`${c.dim}Model: ${config.model}\nBase URL: ${config.baseUrl}\nMax Turns: ${config.maxTurns}\nPermission: ${config.permissionMode}\nStreaming: ${streamingEnabled}\nRoot: ${config.projectRoot}${c.reset}\n`);
            continue;
          case "hooks": {
            const list = agent.getHooks().list();
            list.length === 0
              ? console.log(`${c.dim}No hooks. Create .hooks.json to add.${c.reset}\n`)
              : list.forEach(h => console.log(`${c.dim}  [${h.event}] ${h.description ?? h.command}${c.reset}`));
            if (list.length > 0) console.log();
            continue;
          }
          case "memory": {
            const layers = agent.getMemory().getLayers();
            layers.length === 0
              ? console.log(`${c.dim}No memory layers.${c.reset}\n`)
              : layers.forEach(l => console.log(`${c.dim}  [${l.scope}] ${l.path}: ${l.content.slice(0, 80)}...${c.reset}`));
            if (layers.length > 0) console.log();
            continue;
          }
          default:
            console.log(`${c.red}Unknown: /${cmd}${c.reset}`);
            continue;
        }
      }

      console.log(`${c.dim}\n── Turn ${agent.getTurnCount() + 1} ──${c.reset}\n`);
      if (streamingEnabled) process.stdout.write(`${c.green}${c.bold}Agent:${c.reset} `);
      
      let response = "";
      const generator = agent.run(input, callbacks);
      for await (const event of generator) {
        if (event.type === "done") {
          response = event.content;
        } else if (event.type === "error") {
          console.error(`\n${c.red}Error: ${event.message}${c.reset}`);
        }
      }

      if (!streamingEnabled && response && !response.startsWith("Error:")) {
        console.log(`\n${c.green}${c.bold}Agent:${c.reset} ${response}\n`);
      } else if (streamingEnabled) {
        console.log("\n");
      }
      console.log(`${c.dim}── End ──\n${c.reset}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("EOF") || err.message.includes("ERR_USE_AFTER_CLOSE")) {
          rl.close();
          process.exit(0);
        }
      }
      console.error(`${c.red}Unexpected: ${err}${c.reset}`);
    }
  }
}

main().catch((err) => { console.error(`${c.red}Fatal: ${err}${c.reset}`); process.exit(1); });
