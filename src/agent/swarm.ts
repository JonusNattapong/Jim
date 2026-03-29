import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { childLogger } from "../utils/logger.js";
import type { SubAgentRole } from "./subagent.js";
import { spawnSubAgent } from "./subagent.js";
import type { ToolDefinition } from "../tools/types.js";

// ─── Types ─────────────────────────────────────────────

export interface AgentNode {
  id: string;
  role: SubAgentRole;
  label: string;
  systemPrompt: string;
  tools: string[];
  maxTurns?: number;
}

export interface AgentEdge {
  from: string;
  to: string;
  condition?: (state: SwarmState) => boolean;
  description?: string;
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
  entryNode: string;
  maxDepth?: number;
}

export interface SwarmMessage {
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

export interface SwarmState {
  task: string;
  context: Record<string, string>;
  messages: SwarmMessage[];
  results: Record<string, string>;
  currentPhase: string;
  errors: string[];
  metadata: Record<string, unknown>;
}

export interface SwarmResult {
  state: SwarmState;
  nodeResults: Record<string, string>;
  executionPath: string[];
  totalDurationMs: number;
  agentsSpawned: number;
}

export interface SwarmConfig {
  graph: AgentGraph;
  client: OpenAI;
  model: string;
  allTools: ToolDefinition[];
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>;
  projectRoot: string;
  maxParallel?: number;
  onNodeStart?: (nodeId: string, label: string) => void;
  onNodeComplete?: (nodeId: string, label: string, result: string) => void;
  onHandoff?: (from: string, to: string, reason: string) => void;
}

// ─── Predefined Team Configs ──────────────────────────

export interface TeamMember {
  id: string;
  role: SubAgentRole;
  label: string;
  systemPrompt: string;
  tools: string[];
}

export interface TeamConfig {
  name: string;
  description: string;
  members: TeamMember[];
  workflow: "sequential" | "parallel" | "pipeline" | "swarm";
}

/**
 * PM-Dev-QA team: PM plans, Dev implements in parallel, QA reviews.
 */
export function createDevTeam(projectRoot: string): TeamConfig {
  return {
    name: "dev-team",
    description: "PM plans, Dev implements, QA reviews - full software team",
    workflow: "pipeline",
    members: [
      {
        id: "pm",
        role: "planner",
        label: "Project Manager",
        systemPrompt: `You are a senior project manager. Break down the task into clear, atomic tickets.
For each ticket, specify:
- Ticket ID (e.g. T-001)
- Title
- Description (what to implement)
- Acceptance criteria
- Dependencies (other ticket IDs or "none")
- Estimated complexity (1-5)

Output a structured list of tickets. Be specific about file paths, function names, and interfaces.
Consider: What files need to be created/modified? What's the correct order?`,
        tools: ["read_file", "list_files", "grep", "get_project_info", "get_repo_map"],
      },
      {
        id: "dev-1",
        role: "executor",
        label: "Developer 1",
        systemPrompt: `You are a senior software developer. You receive specific tickets to implement.
Execute each ticket precisely:
1. Read relevant files to understand context
2. Make the required changes
3. Verify your changes compile/work
Report exactly what you changed (files, lines, functions).`,
        tools: ["read_file", "write_file", "edit_file", "list_files", "grep", "run_command", "get_project_info"],
      },
      {
        id: "dev-2",
        role: "executor",
        label: "Developer 2",
        systemPrompt: `You are a senior software developer. You receive specific tickets to implement.
Execute each ticket precisely:
1. Read relevant files to understand context
2. Make the required changes
3. Verify your changes compile/work
Report exactly what you changed (files, lines, functions).`,
        tools: ["read_file", "write_file", "edit_file", "list_files", "grep", "run_command", "get_project_info"],
      },
      {
        id: "qa",
        role: "reviewer",
        label: "QA Engineer",
        systemPrompt: `You are a QA engineer reviewing code changes. Check:
1. Correctness: Does the code match the ticket requirements?
2. Edge cases: Missing error handling, boundary conditions?
3. Integration: Do the pieces work together?
4. Tests: Are there test files that need updating?
5. Build: Run build/test commands to verify

Report issues with specific file:line references. Rate each ticket: PASS / NEEDS_FIX / FAIL.`,
        tools: ["read_file", "list_files", "grep", "run_command", "get_project_info", "get_repo_map"],
      },
    ],
  };
}

/**
 * Research team: Researcher finds info, Writer synthesizes, Editor polishes.
 */
export function createResearchTeam(projectRoot: string): TeamConfig {
  return {
    name: "research-team",
    description: "Research, write, and edit - for documentation and analysis tasks",
    workflow: "pipeline",
    members: [
      {
        id: "researcher",
        role: "web_surfer",
        label: "Researcher",
        systemPrompt: `You are a technical researcher. Find and gather relevant information from the web and codebase.
Focus on: official docs, API references, existing patterns in the code.
Output a structured research brief with sources.`,
        tools: ["read_file", "list_files", "grep", "web_search", "web_fetch", "get_project_info"],
      },
      {
        id: "writer",
        role: "general",
        label: "Writer",
        systemPrompt: `You are a technical writer. Take the research brief and create clear, well-structured content.
Follow the project's existing style and conventions.
Write concisely with examples.`,
        tools: ["read_file", "write_file", "list_files", "grep", "get_project_info"],
      },
      {
        id: "editor",
        role: "reviewer",
        label: "Editor",
        systemPrompt: `You are a technical editor. Review the written content for:
1. Accuracy: Is the information correct?
2. Clarity: Is it easy to understand?
3. Completeness: Are there gaps?
4. Style: Does it match the project conventions?
Provide specific edits and improvements.`,
        tools: ["read_file", "list_files", "grep", "get_project_info"],
      },
    ],
  };
}

// ─── Swarm Orchestrator ───────────────────────────────

function buildNodeTools(node: AgentNode, allTools: ToolDefinition[]): ToolDefinition["function"][] {
  return allTools
    .filter((t) => node.tools.includes(t.function.name))
    .map((t) => t.function);
}

/**
 * Run a single node in the graph.
 */
async function runNode(
  node: AgentNode,
  state: SwarmState,
  config: SwarmConfig,
): Promise<{ output: string; handoff?: string }> {
  const log = childLogger({ component: "swarm", node: node.id });
  const nodeTools = buildNodeTools(node, config.allTools);

  const contextBlock = [
    `## Task\n${state.task}`,
    state.context[node.id] ? `\n## Your Context\n${state.context[node.id]}` : "",
    Object.keys(state.results).length > 0
      ? `\n## Previous Results\n${Object.entries(state.results).map(([k, v]) => `### ${k}\n${v.slice(0, 2000)}`).join("\n\n")}`
      : "",
    state.messages.length > 0
      ? `\n## Team Messages\n${state.messages.slice(-10).map(m => `[${m.from} → ${m.to}]: ${m.content.slice(0, 300)}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  try {
    const result = await spawnSubAgent({
      type: node.role,
      prompt: contextBlock,
      client: config.client,
      model: config.model,
      tools: nodeTools.map((t) => ({
        type: "function" as const,
        function: t,
      })),
      toolExecutor: config.toolExecutor,
      maxTurns: node.maxTurns ?? 15,
    });

    // Check for handoff signals in the output
    const handoffMatch = result.match(/\[HANDOFF:(\w[\w-]*)\]/i);
    const handoff = handoffMatch ? handoffMatch[1] : undefined;

    log.info({ handoff, outputLen: result.length }, "node completed");
    return { output: result, handoff };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "node failed");
    return { output: `Error in ${node.label}: ${msg}` };
  }
}

/**
 * Find the next nodes to execute based on edges and state.
 */
function resolveNextNodes(
  currentNodeId: string,
  graph: AgentGraph,
  state: SwarmState,
  handoff?: string,
): string[] {
  // If there's an explicit handoff, prioritize it
  if (handoff) {
    const handoffNode = graph.nodes.find(n => n.id === handoff);
    if (handoffNode) return [handoff];
  }

  const outgoingEdges = graph.edges.filter(e => e.from === currentNodeId);
  const nextNodes: string[] = [];

  for (const edge of outgoingEdges) {
    if (!edge.condition || edge.condition(state)) {
      nextNodes.push(edge.to);
    }
  }

  return nextNodes;
}

/**
 * Execute the agent graph.
 */
export async function executeSwarm(config: SwarmConfig): Promise<SwarmResult> {
  const log = childLogger({ component: "swarm" });
  const start = Date.now();
  const { graph } = config;
  const maxDepth = graph.maxDepth ?? 20;

  const state: SwarmState = {
    task: "",
    context: {},
    messages: [],
    results: {},
    currentPhase: graph.entryNode,
    errors: [],
    metadata: {},
  };

  const nodeResults: Record<string, string> = {};
  const executionPath: string[] = [];
  let agentsSpawned = 0;

  // BFS execution with parallel support
  const queue: string[] = [graph.entryNode];
  const visited = new Set<string>();
  let depth = 0;

  while (queue.length > 0 && depth < maxDepth) {
    // Group nodes by dependency level for potential parallel execution
    const currentBatch = [...queue];
    queue.length = 0;

    // Execute batch (can be parallelized if independent)
    const promises = currentBatch
      .filter(nodeId => !visited.has(nodeId))
      .map(async (nodeId) => {
        visited.add(nodeId);
        const node = graph.nodes.find(n => n.id === nodeId);
        if (!node) return null;

        config.onNodeStart?.(node.id, node.label);
        state.currentPhase = node.id;

        const { output, handoff } = await runNode(node, state, config);
        agentsSpawned++;

        state.results[node.id] = output;
        nodeResults[node.id] = output;
        executionPath.push(node.id);

        config.onNodeComplete?.(node.id, node.label, output);

        if (handoff) {
          config.onHandoff?.(node.id, handoff, output.slice(0, 100));
        }

        return { nodeId, output, handoff };
      });

    const results = await Promise.all(promises);

    // Resolve next nodes from all completed nodes
    for (const result of results) {
      if (!result) continue;
      const nextNodes = resolveNextNodes(result.nodeId, graph, state, result.handoff);
      for (const next of nextNodes) {
        if (!visited.has(next) && !queue.includes(next)) {
          queue.push(next);
        }
      }
    }

    depth++;
  }

  const totalDurationMs = Date.now() - start;
  log.info({ executionPath, agentsSpawned, totalDurationMs }, "swarm completed");

  return { state, nodeResults, executionPath, totalDurationMs, agentsSpawned };
}

/**
 * Build an agent graph from a team config.
 */
export function buildGraphFromTeam(team: TeamConfig): AgentGraph {
  const nodes: AgentNode[] = team.members.map(m => ({
    id: m.id,
    role: m.role,
    label: m.label,
    systemPrompt: m.systemPrompt,
    tools: m.tools,
  }));

  const edges: AgentEdge[] = [];

  switch (team.workflow) {
    case "sequential":
    case "pipeline":
      // Chain all members sequentially
      for (let i = 0; i < team.members.length - 1; i++) {
        edges.push({
          from: team.members[i].id,
          to: team.members[i + 1].id,
          description: `${team.members[i].label} → ${team.members[i + 1].label}`,
        });
      }
      break;

    case "parallel":
      // First member fans out to all others
      for (let i = 1; i < team.members.length; i++) {
        edges.push({
          from: team.members[0].id,
          to: team.members[i].id,
          description: `${team.members[0].label} → ${team.members[i].label}`,
        });
      }
      break;

    case "swarm":
      // All-to-all connections (any agent can hand off to any other)
      for (const from of team.members) {
        for (const to of team.members) {
          if (from.id !== to.id) {
            edges.push({
              from: from.id,
              to: to.id,
              description: `${from.label} → ${to.label}`,
            });
          }
        }
      }
      break;
  }

  return {
    nodes,
    edges,
    entryNode: team.members[0].id,
  };
}
