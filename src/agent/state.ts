/**
 * Immutable State Management - Deep immutable app state with memoized selectors
 * Pattern: Inspired by Claude Code's DeepImmutable<T> state management
 * 
 * Features:
 * - Type-safe immutable updates
 * - Memoized selectors for efficient updates
 * - State change listeners and subscriptions
 * - Automatic state snapshots for debugging
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Deep immutable type wrapper
 */
export type DeepImmutable<T> = T extends object
  ? {
      readonly [P in keyof T]: DeepImmutable<T[P]>;
    }
  : T;

/**
 * App state definition
 */
export interface AppState {
  session: {
    id: string;
    model: string;
    createdAt: number;
    turnsCompleted: number;
    messagesCount: number;
  };
  context: {
    projectRoot: string;
    repoMap?: string;
    cacheKey?: string;
    lastUpdated?: number;
  };
  messages: ChatCompletionMessageParam[];
  tokens: {
    inputUsed: number;
    outputUsed: number;
    totalUsed: number;
    maxBudget: number;
  };
  tools: {
    active: Set<string>;
    disabled: Set<string>;
    lastExecuted?: string;
  };
  errors: Array<{
    timestamp: number;
    category: string;
    message: string;
    toolName?: string;
  }>;
  memory: {
    archiveSize: number;
    lastArchived?: number;
    truncations: number;
  };
}

/**
 * State update callbacks
 */
export type StateListener<T> = (newState: DeepImmutable<T>, oldState: DeepImmutable<T>) => void;
export type StateSelector<T, R> = (state: DeepImmutable<T>) => R;

/**
 * Immutable state store
 */
export class ImmutableStateStore {
  private state: DeepImmutable<AppState>;
  private listeners: Set<StateListener<AppState>> = new Set();
  private selectorCache: Map<string, unknown> = new Map();
  private history: DeepImmutable<AppState>[] = [];
  private maxHistorySize: number = 50;

  constructor(initialState: AppState) {
    this.state = this.deepFreeze(initialState) as DeepImmutable<AppState>;
  }

  /**
   * Deep freeze an object recursively
   */
  private deepFreeze<T>(obj: T): T {
    if (typeof obj !== "object" || obj === null) return obj;

    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      const val = (obj as Record<string, unknown>)[prop];
      if (
        typeof val === "object" &&
        val !== null &&
        !Object.isFrozen(val) &&
        !(val instanceof Set) &&
        !(val instanceof Map)
      ) {
        this.deepFreeze(val);
      }
    });

    return obj;
  }

  /**
   * Deep merge for updates
   */
  private deepMerge<T>(target: T, updates: unknown): T {
    if (typeof updates !== "object" || updates === null) {
      return updates as T;
    }

    if (Array.isArray(updates)) {
      return updates as T;
    }

    if (typeof target !== "object" || target === null) {
      return updates as T;
    }

    const result = { ...target };
    for (const [key, value] of Object.entries(updates as Record<string, unknown>)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        (result as Record<string, unknown>)[key] = this.deepMerge(
          (target as Record<string, unknown>)[key],
          value,
        );
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Get current state
   */
  getState(): DeepImmutable<AppState> {
    return this.state;
  }

  /**
   * Update state with partial updates
   */
  setState(updates: Partial<AppState>): void {
    const oldState = this.state;
    const merged = this.deepMerge(oldState, updates);
    const newState = Object.freeze(this.deepFreeze(merged)) as DeepImmutable<AppState>;

    if (newState === oldState) return; // No changes

    this.state = newState;
    this.selectorCache.clear(); // Invalidate selector cache

    // Keep history
    this.history.push(oldState);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(newState, oldState));
  }

  /**
   * Memoized selector for efficient subscriptions
   */
  useSelector<T>(selector: StateSelector<AppState, T>, dependencies?: unknown[]): T {
    const key = `${selector.toString()}-${JSON.stringify(dependencies ?? [])}`;

    // Check cache
    if (this.selectorCache.has(key)) {
      const cached = this.selectorCache.get(key) as T;
      return cached;
    }

    const result = selector(this.state);
    this.selectorCache.set(key, result);
    return result;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener<AppState>): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Add error to state
   */
  addError(
    category: string,
    message: string,
    toolName?: string,
  ): void {
    const currentErrors = this.state.errors;
    const newErrors = [
      ...currentErrors,
      {
        timestamp: Date.now(),
        category,
        message,
        toolName,
      },
    ].slice(-20); // Keep last 20

    this.setState({ errors: newErrors });
  }

  /**
   * Update token usage
   */
  updateTokens(
    inputDelta: number,
    outputDelta: number,
  ): void {
    const tokens = this.state.tokens;
    this.setState({
      tokens: {
        ...tokens,
        inputUsed: tokens.inputUsed + inputDelta,
        outputUsed: tokens.outputUsed + outputDelta,
        totalUsed: tokens.totalUsed + inputDelta + outputDelta,
      },
    });
  }

  /**
   * Get state history for debugging
   */
  getHistory(): DeepImmutable<AppState>[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.selectorCache.clear();
  }
}
