import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type SubAgentRole = "explore" | "general" | "planner" | "executor" | "reviewer" | "web_surfer";

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

Your workflow:
1. Search for the relevant documentation or API reference
2. Fetch the most relevant page(s)
3. Extract the key information needed
4. Return a concise, well-structured summary

Focus on:
- Official documentation (not blog posts or StackOverflow unless official docs are unavailable)
- API signatures, parameters, return types
- Breaking changes, deprecations, version differences
- Code examples that demonstrate correct usage

Be thorough but concise. Include URLs of sources.
When done, provide a clear summary with the exact API signatures, parameters, and usage patterns found.
Do NOT guess or use prior knowledge — only report what you actually found on the web.`,
};

/**
 * Spawn a sub-agent with its own isolated context window.
 * Only the final summary returns to the parent agent.
 */
export async function spawnSubAgent(config: SubAgentConfig): Promise<string> {
  const maxTurns = config.maxTurns ?? 10;
  const systemPrompt = ROLE_PROMPTS[config.type];

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  // Inject context if provided
  if (config.context) {
    messages.push({ role: "user", content: `[Context]\n${config.context}\n\n[Task]\n${config.prompt}` });
  } else {
    messages.push({ role: "user", content: config.prompt });
  }

  for (let turn = 0; turn < maxTurns; turn++) {
    try {
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
        return message.content ?? "Sub-agent completed with no output.";
      }

      // Execute tools
      for (const toolCall of message.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await config.toolExecutor(toolCall.function.name, args);
        const truncated = result.content.slice(0, 3000);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: truncated,
        } as ChatCompletionMessageParam);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Sub-agent error: ${msg}`;
    }
  }

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
