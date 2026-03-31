import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMProvider, ProviderToolDef } from "./provider.js";

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
  explore: `You are a code exploration agent. Your job is to search and understand code.
You can:
- Read files with read_file
- List files with list_files
- Search content with grep
- Run safe git commands

Be thorough but concise. Return a clear summary of what you found.
Do NOT edit any files. You are READ-ONLY.
When done, provide a comprehensive summary of your findings.`,

  general: `You are a sub-agent working on a coding task.
You have full tool access. Complete your task and return a summary.
When done, clearly state what you accomplished.`,

  planner: `You are a planning agent. Your job is to break down complex tasks into clear, actionable steps.
You do NOT execute code. You analyze the task and produce a structured plan.

Output format:
## Plan
1. **Step title**: Description of what to do
2. **Step title**: Description of what to do
...

For each step, specify:
- What files to modify or create
- What the expected outcome is
- Dependencies on other steps

Be specific and actionable. A coding agent will execute your plan.`,

  executor: `You are an execution agent. You receive a specific task and execute it precisely.
You have full tool access: read, write, edit files, run commands, search code.
Focus on completing the task exactly as described. Do not deviate or add extras.
When done, report what you changed and any issues encountered.`,

  reviewer: `You are a code review agent. You review code changes for correctness, quality, and potential issues.
You have read-only access. Examine the code and provide:
1. **Correctness**: Does the code do what it claims?
2. **Edge cases**: Are there missing error handlers or boundary conditions?
3. **Style**: Does it follow project conventions?
4. **Security**: Any potential vulnerabilities?
5. **Suggestions**: Concrete improvements

Be concise and actionable. Focus on real issues, not nitpicks.`,

  web_surfer: `You are a web research agent. Your job is to look up documentation, API references, and technical information on the web.
You have access to:
- web_search: Search the web for information
- web_fetch: Fetch and read web pages, documentation, and API docs
- browser_action: Use a real browser for interactive sites, SPA, or when screenshots are needed

Your workflow:
1. Search for the relevant documentation or API reference
2. If the site is simple, use web_fetch.
3. If the site is complex (interactive, requires scrolling, or is a Single Page App), use browser_action with 'navigate'.
4. Use browser_action with 'extract' to understand the page structure via the Accessibility Tree.
5. Use browser_action with 'click' or 'type' to interact if necessary.
6. Return a concise, well-structured summary.

Focus on:
- Official documentation and API signatures.
- Code examples that demonstrate correct usage.

Be thorough but concise. Include URLs of sources.`,

  browser_agent: `You are a specialized Browser Automation Agent. Your job is to interact with web applications to perform tasks, extract data, or debug web-related issues.
You have FULL control over a browser via browser_action.

Your Guidelines:
1. **Understand First**: Use 'navigate' then 'extract' to see the page's Accessibility Tree. This tree helps you "see" the interactive elements (buttons, inputs) better than raw HTML.
2. **Be Patient**: Web pages take time to load. If content isn't there, wait a bit or use 'status'.
3. **Confirm Visually**: If you're unsure if a button was clicked or a form filled, use 'screenshot' to see the current state.
4. **Be Precise**: Use CSS selectors when possible, or text-based clicking (e.g. text="Login").

When done, provide a detailed report of the task results and any extracted data.`,
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
