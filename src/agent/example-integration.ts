/**
 * Example: Integrating Claude Code Patterns into Jim Agent Loop
 * 
 * This example shows how to use all the new systems together
 */

import type { WorkMode } from "./prompt.js";
import { bootstrap, type BootstrapState } from "./bootstrap.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { feature } from "./feature-gates.js";
import type { PermissionContext } from "../permissions/security-policy.js";

/**
 * Example: Enhanced agent loop with new systems
 */
export async function* enhancedAgentLoop(
  systemPrompt: string,
  userMessage: string,
  sessionId: string,
  maxTurns: number = 25,
): AsyncGenerator<{
  type:
    | "thinking"
    | "tool_executing"
    | "tool_result"
    | "message"
    | "error"
    | "done";
  data: unknown;
}> {
  // ============ 1. BOOTSTRAP ALL SYSTEMS ============
  const bootState = bootstrap({
    sessionId,
    userId: "agent-user",
    model: "gpt-4",
    projectRoot: process.cwd(),
    maxConcurrentTools: 5,
    tokenBudget: 100000,
  });

  const {
    stateStore,
    executor,
    errorHandler,
    cacheManager,
    securityManager,
  } = bootState;

  yield {
    type: "message",
    data: { role: "system", content: "✓ Agent systems initialized" },
  };

  // ============ 2. SET UP STATE ============
  stateStore.setState({
    session: {
      ...stateStore.getState().session,
      turnsCompleted: 0,
    },
  });

  // ============ 3. CHECK FEATURE FLAGS ============
  yield {
    type: "thinking",
    data: `Features: streaming=${feature("streaming_executor")}, permissions=${feature("enhanced_permissions")}`,
  };

  // ============ 4. INITIALIZE SECURITY POLICY ============
  // (In real code, load from config)
  securityManager.registerPolicy({
    id: "default-policy",
    name: "Default Security Policy",
    description: "Default security policy for the agent",
    priority: 0,
    enabled: true,
    rules: [
      {
        id: "allow-local-read",
        source: "project",
        resource: "file",
        pattern: ".*\\.(ts|tsx|js|json)$",
        behavior: "allow",
        reason: "Local project files",
      },
    ],
  });

  // ============ 5. LOAD CACHED CONTEXT ============
  yield { type: "thinking", data: "Loading cached context..." };

  // Simulate loading repo map with caching
  const repoMapPromise = cacheManager.get(
    "repo-map",
    async () => {
      // In real code: await get_repo_map_handler()
      return "Sample repo structure...";
    },
    ["git-status"],
  );

  // ============ 6. MAIN AGENT LOOP ============
  for (let turn = 0; turn < maxTurns; turn++) {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // Check feature gate for streaming
    if (feature("streaming_executor")) {
      yield {
        type: "thinking",
        data: "Using streaming executor for tool execution",
      };

      // Get remaining token budget before making API call
      const tokenStatus = stateStore.getState().tokens;
      if (tokenStatus.totalUsed > tokenStatus.maxBudget * 0.8) {
        // Close to limit - should compact
        yield {
          type: "message",
          data: "⚠️ Token budget 80% used, compaction needed",
        };
      }
    }

    // Simulate tool execution
    const toolResults = [];

    try {
      // ============ 7. CHECK PERMISSIONS ============
      const permContext: PermissionContext = {
        source: "user",
        resource: "file",
        target: "src/file.ts",
        toolName: "read_file",
      };

      const decision = securityManager.checkPermission(permContext);
      if (!decision.allowed) {
        yield {
          type: "error",
          data: `Permission denied: ${decision.reason}`,
        };
        continue;
      }

      // ============ 8. EXECUTE TOOLS (with feature gate) ============
      if (feature("streaming_executor")) {
        // Queue tools for concurrent execution
        const batchId = executor.queueTools([
          {
            toolName: "example_tool",
            handler: async () => ({ content: "Tool result" }),
            args: { path: "test.ts" },
            priority: 1,
          },
        ]);

        // Execute all queued tools
        const results = await executor.executeQueue();
        for (const result of results) {
          yield {
            type: "tool_result",
            data: result,
          };

          toolResults.push({
            tool_name: result.toolName,
            content: result.result.content,
          });
        }

        // Get executor status
        const status = executor.getStatus();
        yield {
          type: "thinking",
          data: `Executor status: ${JSON.stringify(status)}`,
        };
      } else {
        // Fallback to sequential execution
        yield {
          type: "thinking",
          data: "Using fallback sequential execution",
        };
      }

      // ============ 9. UPDATE STATE ============
      stateStore.setState({
        session: {
          ...stateStore.getState().session,
          turnsCompleted: turn + 1,
          messagesCount: messages.length,
        },
      });

      // ============ 10. SIMULATED API CALL ============
      // In real code: call OpenAI API
      yield {
        type: "message",
        data: { role: "assistant", content: "Response to user message" },
      };

      // Update token usage (simulate)
      stateStore.updateTokens(500, 300);

      // Check if done
      if (turn === maxTurns - 1) {
        yield { type: "done", data: { success: true } };
        break;
      }
    } catch (err) {
      // ============ 11. HANDLE ERRORS ============
      const agentError = errorHandler.handleError(err, "example_tool");

      yield {
        type: "error",
        data: errorHandler.formatErrorMessage(agentError),
      };

      // Check recovery options
      if (errorHandler.isRetryable(agentError)) {
        yield {
          type: "thinking",
          data: `Error is retryable: ${agentError.message}`,
        };
      }

      if (agentError.category === "token_overflow") {
        yield {
          type: "thinking",
          data: "Token overflow - context compaction needed",
        };
      }

      // Continue or break based on error
      if (agentError.category === "validation" || agentError.category === "tool") {
        break;
      }
    }
  }

  // ============ 12. FINAL REPORTING ============
  yield {
    type: "message",
    data: {
      stats: {
        errorSummary: errorHandler.getSummary(),
        tokenStatus: stateStore.getState().tokens,
        cacheStats: cacheManager.getStats(),
        permissionLog: securityManager.getAuditLog(undefined, 5),
      },
    },
  };

  // ============ 13. CLEANUP ============
  const { shutdown } = await import("./bootstrap.js");
  shutdown(bootState);

  yield {
    type: "message",
    data: { role: "system", content: "✓ Systems shut down cleanly" },
  };
}

/**
 * Usage example
 */
async function runExample() {
  const systemPrompt = "You are a helpful assistant.";
  const userMessage = "What is TypeScript?";

  for await (const output of enhancedAgentLoop(
    systemPrompt,
    userMessage,
    "test-session",
  )) {
    console.log(`[${output.type}]`, output.data);
  }
}

// Uncomment to run:
// runExample().catch(console.error);
