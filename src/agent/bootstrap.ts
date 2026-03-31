/**
 * Bootstrap & Initialization - Initialize all new systems
 * 
 * This module sets up:
 * - Immutable state store
 * - Streaming executor
 * - Error handler
 * - Cache manager
 * - Security policy manager
 * - Feature gates
 */

import type { AppState } from "./state.js";
import { ImmutableStateStore } from "./state.js";
import { StreamingToolExecutor } from "./streaming-executor.js";
import { ErrorHandler } from "./error-handler.js";
import { ContextCacheManager } from "./cache-manager.js";
import { SecurityPolicyManager } from "../permissions/security-policy.js";
import { initializeFeatureGates } from "./feature-gates.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "Bootstrap" });

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  sessionId: string;
  userId?: string;
  model: string;
  projectRoot: string;
  maxConcurrentTools?: number;
  tokenBudget?: number;
  cacheTtlMs?: number;
}

/**
 * Bootstrap state returned to agent
 */
export interface BootstrapState {
  stateStore: ImmutableStateStore;
  executor: StreamingToolExecutor;
  errorHandler: ErrorHandler;
  cacheManager: ContextCacheManager;
  securityManager: SecurityPolicyManager;
  sessionId: string;
}

/**
 * Initialize all systems
 */
export function bootstrap(config: BootstrapConfig): BootstrapState {
  log.info({ sessionId: config.sessionId }, "Initializing agent systems...");

  // Initialize feature gates
  initializeFeatureGates(config.userId);

  // Create initial state
  const initialState: AppState = {
    session: {
      id: config.sessionId,
      model: config.model,
      createdAt: Date.now(),
      turnsCompleted: 0,
      messagesCount: 0,
    },
    context: {
      projectRoot: config.projectRoot,
    },
    messages: [],
    tokens: {
      inputUsed: 0,
      outputUsed: 0,
      totalUsed: 0,
      maxBudget: config.tokenBudget ?? 100000,
    },
    tools: {
      active: new Set(),
      disabled: new Set(),
    },
    errors: [],
    memory: {
      archiveSize: 0,
      truncations: 0,
    },
  };

  // Initialize state store
  const stateStore = new ImmutableStateStore(initialState);

  // Initialize systems
  const executor = new StreamingToolExecutor({
    maxConcurrent: config.maxConcurrentTools ?? 5,
  });

  const errorHandler = new ErrorHandler();

  const cacheManager = new ContextCacheManager({
    ttlMs: config.cacheTtlMs ?? 3600000,
  });

  const securityManager = new SecurityPolicyManager();

  log.info(
    {
      sessionId: config.sessionId,
      systems: [
        "ImmutableStateStore",
        "StreamingToolExecutor",
        "ErrorHandler",
        "ContextCacheManager",
        "SecurityPolicyManager",
        "FeatureGates",
      ],
    },
    "All systems initialized successfully",
  );

  return {
    stateStore,
    executor,
    errorHandler,
    cacheManager,
    securityManager,
    sessionId: config.sessionId,
  };
}

/**
 * Destroy all systems (cleanup)
 */
export function shutdown(state: BootstrapState): void {
  log.info({ sessionId: state.sessionId }, "Shutting down agent systems...");

  state.executor.clear();
  state.cacheManager.clear();
  state.errorHandler.clear();

  log.info("All systems shut down");
}
