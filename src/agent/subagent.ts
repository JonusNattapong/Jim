import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMProvider, ProviderToolDef } from "./provider.js";
import { DEFAULT_AGENT_PROMPT } from "../constants/prompts.js";

export type SubAgentRole = "explore" | "general" | "planner" | "executor" | "reviewer" | "web_surfer" | "browser_agent";

export interface SubAgentConfig {
  type: SubAgentRole;
  prompt: string;
  client: OpenAI;
  model: string;
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: { type: "object"; properties: Record<string, unknown>; required: string[] };
    };
  }>;
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>;
  maxTurns?: number;
  /** Context to inject (e.g. plan, executor output, code to review) */
  context?: string;
  /** LLM provider abstraction — when set, used instead of raw client.chat.completions */
  provider?: LLMProvider;
  /** Initial task description (used for progress UI) */
  task?: string;
  /** Progress callback */
  onUpdate?: (status: SubAgentStatus) => void;
}

export interface SubAgentStatus {
  id: string;
  role: SubAgentRole;
  task: string;
  status: "running" | "done" | "error";
  toolsCalled: number;
  tokensUsed: number;
  cost: number;
  currentTool?: string;
  result?: string;
}

const ROLE_PROMPTS: Record<SubAgentRole, string> = {
  explore: `${DEFAULT_AGENT_PROMPT}

## Your Role: Code Exploration Agent

Your job is to search and understand code.

**Allowed Tools:**
- read_file: Read file contents
- list_files: Discover files
- grep: Search content
- git_command: Safe git operations (read-only)

**Guidelines:**
- Be thorough but concise
- Do NOT edit any files — you are READ-ONLY
- Return a clear summary of what you found
- When referencing code, use format: file_path:line_number
- Focus on understanding the architecture and patterns`,

  general: `${DEFAULT_AGENT_PROMPT}

## Your Role: General Task Agent

You have full tool access to complete the assigned task.

**Guidelines:**
- Complete the task fully — don't gold-plate, but don't leave it half-done
- Make minimal, focused changes
- Verify your work before reporting completion
- Return a concise report of what was accomplished`,

  planner: `${DEFAULT_AGENT_PROMPT}

## Your Role: Planning Agent

Your job is to break down complex tasks into clear, actionable steps.

**Important:** You do NOT execute code. You analyze and plan only.

**Output Format:**
## Plan
1. **Step title**: Description of what to do
2. **Step title**: Description of what to do
...

**For each step specify:**
- What files to modify or create
- Expected outcome
- Dependencies on other steps

Be specific and actionable. An execution agent will follow your plan.`,

  executor: `${DEFAULT_AGENT_PROMPT}

## Your Role: Execution Agent

You receive a specific task and execute it precisely.

**Guidelines:**
- Focus on completing the task exactly as described
- Do not deviate or add extras beyond the scope
- Prefer dedicated tools over bash commands
- Use parallel tool calls when independent
- Report what you changed and any issues encountered`,

  reviewer: `${DEFAULT_AGENT_PROMPT}

## Your Role: Code Review Agent

You review code changes for correctness, quality, and potential issues.

**Review Checklist:**
1. **Correctness**: Does the code do what it claims?
2. **Edge cases**: Missing error handlers or boundary conditions?
3. **Style**: Does it follow project conventions?
4. **Security**: Any potential vulnerabilities?
5. **Efficiency**: Any performance concerns?

**Output Format:**
- [ISSUE] [description with file:line reference]
- [PRAISE] [what was done well]
- [SUGGESTION] [concrete improvement]

Be concise. Focus on real issues, not nitpicks.`,

  web_surfer: `${DEFAULT_AGENT_PROMPT}

## Your Role: Web Research Agent

Your job is to look up documentation, API references, and technical information.

**Allowed Tools:**
- web_search: Search the web
- web_fetch: Read web pages and documentation
- browser_action: Use real browser for interactive sites

**Workflow:**
1. Search for relevant documentation
2. For simple sites: use web_fetch
3. For complex sites (SPA, interactive): use browser_action
4. Use browser_action 'extract' to understand page structure
5. Return a concise, well-structured summary

**Focus:**
- Official documentation and API signatures
- Code examples demonstrating correct usage
- Include URLs of sources`,

  browser_agent: `${DEFAULT_AGENT_PROMPT}

## Your Role: Browser Automation Agent

You interact with web applications to perform tasks or extract data.

**Guidelines:**
1. **Understand First**: Use 'navigate' then 'extract' to see the page's Accessibility Tree
2. **Be Patient**: Web pages take time to load — wait if content isn't ready
3. **Confirm Visually**: Use 'screenshot' to verify actions if unsure
4. **Be Precise**: Use CSS selectors or text-based clicking

**Workflow:**
- Navigate → Extract (understand structure) → Interact → Verify

Provide a detailed report of results and any extracted data.`,
};

/**
 * Spawn a sub-agent with its own isolated context window.
 * Only the final summary returns to the parent agent.
 */
export async function spawnSubAgent(config: SubAgentConfig): Promise<string> {
  const maxTurns = config.maxTurns ?? 10;
  const systemPrompt = ROLE_PROMPTS[config.type];
  const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const status: SubAgentStatus = {
    id,
    role: config.type,
    task: config.task || config.prompt.slice(0, 100),
    status: "running",
    toolsCalled: 0,
    tokensUsed: 0,
    cost: 0,
  };

  const notify = () => config.onUpdate?.({ ...status });

  notify();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  // Inject context if provided
  if (config.context) {
    messages.push({ role: "user", content: `[Context]\n${config.context}\n\n[Task]\n${config.prompt}` });
  } else {
    messages.push({ role: "user", content: config.prompt });
  }

  const toolDefs: ProviderToolDef[] = config.tools.map(t => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown>,
    },
  }));

  for (let turn = 0; turn < maxTurns; turn++) {
    try {
      if (config.provider) {
        // Use provider abstraction (supports Anthropic, Vertex, Bedrock, etc.)
        const response = await config.provider.complete(messages, toolDefs, {
          model: config.model,
          temperature: 0,
          maxTokens: 4096,
        });

        if (!response.content && response.toolCalls.length === 0) {
          return "Sub-agent: No response from model";
        }

        // Build assistant message for history
        const assistantMsg: ChatCompletionMessageParam = response.toolCalls.length > 0
          ? {
              role: "assistant",
              content: response.content || null,
              tool_calls: response.toolCalls.map(tc => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            } as ChatCompletionMessageParam
          : { role: "assistant", content: response.content };

        messages.push(assistantMsg);

        // Update usage after model turn
        if (response.usage) {
          status.tokensUsed += response.usage.totalTokens;
          status.cost += (response.usage.totalTokens / 1000000) * 3.00;
          notify();
        }

        // Done — no tool calls
        if (response.toolCalls.length === 0) {
          status.status = "done";
          status.result = response.content ?? "Sub-agent completed.";
          notify();
          return response.content ?? "Sub-agent completed with no output.";
        }

        // Execute tools
        for (const toolCall of response.toolCalls) {
          status.toolsCalled++;
          
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.arguments);
          } catch {
            args = {};
          }

          const argStr = Object.entries(args)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 40) + (v.length > 40 ? "..." : "") : JSON.stringify(v)}`)
            .join(", ");
          
          status.currentTool = `${toolCall.name}(${argStr})`;
          notify();

          const result = await config.toolExecutor(toolCall.name, args);
          const truncated = result.content.slice(0, 3000);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: truncated,
          } as ChatCompletionMessageParam);
        }
      } else {
        // Fallback: direct OpenAI client (legacy path)
        const response = await config.client.chat.completions.create({
          model: config.model,
          messages,
          tools: config.tools,
          temperature: 0,
          max_tokens: 4096,
        });

        const choice = response.choices[0];
        if (!choice) return "Sub-agent: No response from model";

        const message = choice.message;
        messages.push(message as ChatCompletionMessageParam);

        // Done
        if (!message.tool_calls) {
          status.status = "done";
          status.result = message.content ?? "Sub-agent completed.";
          notify();
          return message.content ?? "Sub-agent completed with no output.";
        }

        // Execute tools
        for (const toolCall of message.tool_calls) {
          status.toolsCalled++;
          
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          const argStr = Object.entries(args)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 40) + (v.length > 40 ? "..." : "") : JSON.stringify(v)}`)
            .join(", ");
          
          status.currentTool = `${toolCall.function.name}(${argStr})`;
          notify();

          const result = await config.toolExecutor(toolCall.function.name, args);
          const truncated = result.content.slice(0, 3000);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: truncated,
          } as ChatCompletionMessageParam);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Sub-agent error: ${msg}`;
    }
  }

  status.status = "error";
  status.result = `Sub-agent reached max turns (${maxTurns}).`;
  notify();
  return `Sub-agent reached max turns (${maxTurns}). Last message may be incomplete.`;
}

/**
 * Spawn multiple sub-agents in parallel.
 */
export async function spawnParallelAgents(configs: SubAgentConfig[]): Promise<string[]> {
  return Promise.all(configs.map((c) => spawnSubAgent(c)));
}

/**
 * A background job handle for non-blocking sub-agent execution.
 */
export interface BackgroundJob {
  id: string;
  role: SubAgentRole;
  status: "running" | "done" | "error";
  result?: string;
  promise: Promise<string>;
}

/**
 * Spawn a sub-agent in the background (non-blocking).
 * Returns a handle that can be polled for results.
 */
export function spawnBackground(config: SubAgentConfig): BackgroundJob {
  const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const promise = spawnSubAgent(config);

  const job: BackgroundJob = {
    id,
    role: config.type,
    status: "running",
    promise: promise.then(
      (result) => { job.status = "done"; job.result = result; return result; },
      (err) => { job.status = "error"; job.result = String(err); return String(err); },
    ),
  };

  return job;
}

/**
 * Plan-Execute-Review workflow.
 * 1. Planner breaks down the task
 * 2. Executor runs each step
 * 3. Reviewer validates the result
 * Returns the final review or executor output.
 */
export async function planExecuteReview(
  task: string,
  config: Omit<SubAgentConfig, "type" | "prompt" | "context">,
): Promise<{ plan: string; execution: string; review: string }> {
  // Step 1: Plan
  const readOnlyTools = config.tools.filter((t) =>
    ["read_file", "list_files", "grep", "get_project_info", "git_command", "get_repo_map"].includes(t.function.name)
  );

  const plan = await spawnSubAgent({
    ...config,
    type: "planner",
    prompt: `Break down this task into steps:\n\n${task}`,
    tools: readOnlyTools,
    maxTurns: 5,
  });

  // Step 2: Execute
  const execution = await spawnSubAgent({
    ...config,
    type: "executor",
    prompt: `Execute this plan:\n\n${plan}\n\nOriginal task: ${task}`,
    tools: config.tools,
    context: plan,
    maxTurns: 20,
  });

  // Step 3: Review
  const review = await spawnSubAgent({
    ...config,
    type: "reviewer",
    prompt: `Review the following execution:\n\nTask: ${task}\n\nPlan:\n${plan}\n\nExecution result:\n${execution}`,
    tools: readOnlyTools,
    maxTurns: 5,
  });

  return { plan, execution, review };
}
