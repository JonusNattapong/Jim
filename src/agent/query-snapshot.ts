/**
 * Query Config Snapshot - Prevents mid-query config mutations
 * Pattern: Inspired by Claude Code's immutable config approach
 * 
 * Problem: Config can change mid-query (model, maxTokens, system prompt)
 * causing inconsistent behavior and wasted API calls
 * 
 * Solution: Snapshot config at query start, use throughout query lifecycle
 */

export interface QueryConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature?: number;
  systemPrompt: string;
  timeout: number;
  maxRetries: number;
}

export interface QuerySnapshot {
  config: Readonly<QueryConfig>;
  createdAt: number;
  queryId: string;
  hash: string;
}

/**
 * Create immutable snapshot of current config
 */
export function createQuerySnapshot(
  config: QueryConfig,
  queryId: string,
): QuerySnapshot {
  const snapshot: QuerySnapshot = {
    config: Object.freeze({ ...config }),
    createdAt: Date.now(),
    queryId,
    hash: hashConfig(config),
  };
  return Object.freeze(snapshot) as unknown as QuerySnapshot;
}

/**
 * Hash config to detect mutations
 */
function hashConfig(config: QueryConfig): string {
  const str = JSON.stringify(config);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Validate config snapshot integrity during query
 */
export function validateSnapshotIntegrity(
  snapshot: QuerySnapshot,
  currentConfig: QueryConfig,
): {
  valid: boolean;
  mutations?: string[];
} {
  const currentHash = hashConfig(currentConfig);
  
  if (snapshot.hash !== currentHash) {
    // Detect which fields changed
    const mutations: string[] = [];
    const keys = Object.keys(snapshot.config) as (keyof QueryConfig)[];
    
    for (const key of keys) {
      if (snapshot.config[key] !== currentConfig[key]) {
        mutations.push(key);
      }
    }
    
    return {
      valid: false,
      mutations,
    };
  }
  
  return { valid: true };
}

/**
 * Query builder that requires snapshot
 */
export class QueryBuilder {
  private snapshot: QuerySnapshot;
  private log = console.log;

  constructor(snapshot: QuerySnapshot) {
    this.snapshot = Object.freeze(snapshot);
  }

  /**
   * Build query with guaranteed consistent config
   */
  buildQuery(messages: Array<{ role: string; content: string }>): {
    model: string;
    messages: typeof messages;
    max_tokens: number;
    temperature?: number;
    system?: string;
  } {
    return {
      model: this.snapshot.config.model,
      messages,
      max_tokens: this.snapshot.config.maxTokens,
      temperature: this.snapshot.config.temperature,
      system: this.snapshot.config.systemPrompt,
    };
  }

  /**
   * Get config snapshot for this query
   */
  getSnapshot(): Readonly<QuerySnapshot> {
    return this.snapshot;
  }

  /**
   * Get config from snapshot
   */
  getConfig(): Readonly<QueryConfig> {
    return this.snapshot.config;
  }

  /**
   * Check if snapshot is still valid against a potentially updated config
   */
  validateAgainstCurrent(currentConfig: QueryConfig): boolean {
    const validation = validateSnapshotIntegrity(this.snapshot, currentConfig);
    if (!validation.valid) {
      this.log(
        `⚠️  Config mutation detected during query: ${validation.mutations?.join(", ")}`,
      );
      return false;
    }
    return true;
  }
}
