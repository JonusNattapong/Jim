/**
 * Query Pipeline - Async Generator Agent Loop
 * 
 * Inspired by Claude Code's query.ts which implements a recursive
 * async generator pattern for processing messages, executing tools,
 * and managing context across turns.
 * 
 * @see https://github.com/anthropics/claude-code
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Message roles in the conversation
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * A single message in the conversation
 */
export interface Message {
  role: MessageRole;
  content: string | MessageContent[];
  name?: string;
  tool_call_id?: string;
  timestamp: number;
  uuid: string;
  metadata?: Record<string, unknown>;
}

/**
 * Message content blocks
 */
export type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
  | { type: "thinking"; thinking: string };

/**
 * Query pipeline state
 */
export interface QueryState {
  messages: Message[];
  turnCount: number;
  maxTurns: number;
  totalTokensUsed: number;
  maxTokens: number;
  abortController: AbortController;
  transition?: TransitionReason;
  error?: Error;
}

/**
 * Why the query loop continued to next iteration
 */
export type TransitionReason =
  | "tool_use"
  | "error_recovery"
  | "max_turns"
  | "abort"
  | "completed"
  | "budget_exceeded";

/**
 * Query pipeline configuration
 */
export interface QueryPipelineConfig {
  maxTurns: number;
  maxTokens: number;
  systemPrompt: string;
  model: string;
  temperature?: number;
  onProgress?: (event: PipelineEvent) => void;
}

/**
 * Pipeline events for progress tracking
 */
export type PipelineEvent =
  | { type: "turn_start"; turn: number }
  | { type: "api_request"; messages: number }
  | { type: "api_response"; tokens: number }
  | { type: "tool_start"; toolName: string; toolId: string }
  | { type: "tool_end"; toolName: string; toolId: string; success: boolean }
  | { type: "turn_end"; turn: number; transition: TransitionReason }
  | { type: "error"; error: Error }
  | { type: "complete"; totalTurns: number; totalTokens: number };

/**
 * Tool execution function
 */
export type ToolExecutor = (
  toolName: string,
  toolId: string,
  input: Record<string, unknown>
) => AsyncGenerator<{ type: "progress" | "result"; content: string }>;

/**
 * API call function
 */
export type APICaller = (
  messages: Message[],
  systemPrompt: string
) => AsyncGenerator<{ type: "content" | "tool_use" | "done"; content: MessageContent }>;

// ============================================================================
// State Management
// ============================================================================

/**
 * Create initial query state
 */
export function createQueryState(config: QueryPipelineConfig): QueryState {
  return {
    messages: [],
    turnCount: 0,
    maxTurns: config.maxTurns,
    totalTokensUsed: 0,
    maxTokens: config.maxTokens,
    abortController: new AbortController(),
  };
}

/**
 * Add a message to the state
 */
export function addMessage(state: QueryState, message: Message): QueryState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Check if budget is exceeded
 */
export function isBudgetExceeded(state: QueryState): boolean {
  return state.totalTokensUsed >= state.maxTokens;
}

/**
 * Check if max turns exceeded
 */
export function isMaxTurnsExceeded(state: QueryState): boolean {
  return state.turnCount >= state.maxTurns;
}

/**
 * Check if query should continue
 */
export function shouldContinue(state: QueryState): boolean {
  if (state.abortController.signal.aborted) return false;
  if (isBudgetExceeded(state)) return false;
  if (isMaxTurnsExceeded(state)) return false;
  return true;
}

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Generate a UUID for messages
 */
export function generateUUID(): string {
  return crypto.randomUUID?.() ?? 
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): Message {
  return {
    role: "user",
    content,
    timestamp: Date.now(),
    uuid: generateUUID(),
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: MessageContent[],
  metadata?: Record<string, unknown>
): Message {
  return {
    role: "assistant",
    content,
    timestamp: Date.now(),
    uuid: generateUUID(),
    metadata,
  };
}

/**
 * Create a tool result message
 */
export function createToolResultMessage(
  toolCallId: string,
  content: string,
  isError = false
): Message {
  return {
    role: "tool",
    content: JSON.stringify({
      type: "tool_result",
      tool_use_id: toolCallId,
      content,
      is_error: isError,
    }),
    tool_call_id: toolCallId,
    timestamp: Date.now(),
    uuid: generateUUID(),
  };
}

/**
 * Extract tool uses from assistant message
 */
export function extractToolUses(message: Message): Array<{
  id: string;
  name: string;
  input: Record<string, unknown>;
}> {
  if (typeof message.content === "string") return [];
  
  return message.content
    .filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      c.type === "tool_use"
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      input: c.input,
    }));
}

/**
 * Count tokens in messages (rough estimate)
 */
export function estimateTokenCount(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += Math.ceil(msg.content.length / 4);
    } else {
      for (const block of msg.content) {
        if (block.type === "text") {
          total += Math.ceil(block.text.length / 4);
        } else if (block.type === "tool_use") {
          total += Math.ceil(JSON.stringify(block.input).length / 4);
        } else if (block.type === "tool_result") {
          total += Math.ceil(block.content.length / 4);
        }
      }
    }
  }
  return total;
}

// ============================================================================
// Query Pipeline
// ============================================================================

/**
 * Main query pipeline - async generator that processes messages
 * and executes tools across multiple turns
 */
export async function* queryPipeline(
  initialMessages: Message[],
  config: QueryPipelineConfig,
  apiCaller: APICaller,
  toolExecutor: ToolExecutor
): AsyncGenerator<PipelineEvent, QueryState, void> {
  let state: QueryState = {
    ...createQueryState(config),
    messages: [...initialMessages],
  };

  yield { type: "turn_start", turn: state.turnCount + 1 };

  while (shouldContinue(state)) {
    state = { ...state, turnCount: state.turnCount + 1 };

    yield { type: "turn_start", turn: state.turnCount };
    config.onProgress?.({ type: "turn_start", turn: state.turnCount });

    try {
      // Collect assistant response
      const contentBlocks: MessageContent[] = [];
      let hasToolUse = false;

      yield { type: "api_request", messages: state.messages.length };

      // Call API and collect response
      for await (const event of apiCaller(state.messages, config.systemPrompt)) {
        if (event.type === "content" || event.type === "tool_use") {
          contentBlocks.push(event.content);
          if (event.type === "tool_use") {
            hasToolUse = true;
          }
        }
      }

      // Create assistant message
      const assistantMessage = createAssistantMessage(contentBlocks);
      state = addMessage(state, assistantMessage);

      yield { type: "api_response", tokens: estimateTokenCount(state.messages) };

      // If no tool use, query is complete
      if (!hasToolUse) {
        state = { ...state, transition: "completed" };
        yield { type: "turn_end", turn: state.turnCount, transition: "completed" };
        break;
      }

      // Execute tools
      const toolUses = extractToolUses(assistantMessage);

      for (const toolUse of toolUses) {
        yield { type: "tool_start", toolName: toolUse.name, toolId: toolUse.id };

        let resultContent = "";
        let success = true;

        try {
          for await (const event of toolExecutor(toolUse.name, toolUse.id, toolUse.input)) {
            if (event.type === "result") {
              resultContent = event.content;
            }
          }
        } catch (error) {
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
          success = false;
        }

        // Add tool result message
        const toolResultMessage = createToolResultMessage(
          toolUse.id,
          resultContent,
          !success
        );
        state = addMessage(state, toolResultMessage);

        yield { type: "tool_end", toolName: toolUse.name, toolId: toolUse.id, success };
      }

      state = { ...state, transition: "tool_use" };
      yield { type: "turn_end", turn: state.turnCount, transition: "tool_use" };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state = { ...state, error: err, transition: "error_recovery" };
      
      yield { type: "error", error: err };

      // Check if we should retry or abort
      if (isMaxTurnsExceeded(state)) {
        state = { ...state, transition: "max_turns" };
        yield { type: "turn_end", turn: state.turnCount, transition: "max_turns" };
        break;
      }

      yield { type: "turn_end", turn: state.turnCount, transition: "error_recovery" };
    }

    // Check budget
    if (isBudgetExceeded(state)) {
      state = { ...state, transition: "budget_exceeded" };
      yield { type: "turn_end", turn: state.turnCount, transition: "budget_exceeded" };
      break;
    }
  }

  yield {
    type: "complete",
    totalTurns: state.turnCount,
    totalTokens: state.totalTokensUsed,
  };

  return state;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format pipeline state for debugging
 */
export function formatPipelineState(state: QueryState): string {
  const lines = [
    `📊 Query Pipeline State`,
    `   Turn: ${state.turnCount}/${state.maxTurns}`,
    `   Messages: ${state.messages.length}`,
    `   Tokens: ${state.totalTokensUsed}/${state.maxTokens}`,
    `   Transition: ${state.transition ?? "initial"}`,
    `   Aborted: ${state.abortController.signal.aborted}`,
  ];
  if (state.error) {
    lines.push(`   Error: ${state.error.message}`);
  }
  return lines.join("\n");
}

/**
 * Get last assistant message from state
 */
export function getLastAssistantMessage(state: QueryState): Message | null {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === "assistant") {
      return state.messages[i];
    }
  }
  return null;
}

/**
 * Extract text content from message
 */
export function extractTextContent(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  
  return message.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

// ============================================================================
// Exports
// ============================================================================

export const QueryPipeline = {
  createQueryState,
  addMessage,
  isBudgetExceeded,
  isMaxTurnsExceeded,
  shouldContinue,
  generateUUID,
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  extractToolUses,
  estimateTokenCount,
  queryPipeline,
  formatPipelineState,
  getLastAssistantMessage,
  extractTextContent,
} as const;