export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  content: string;
  isError?: boolean;
  diff?: string;
  /** Arbitrary metadata about the tool result (e.g., process ID) */
  metadata?: Record<string, any>;
  /** Whether the result was persisted to an external file */
  persisted?: boolean;
  /** Full path or URL to the persisted result */
  reference?: string;
  /**
   * When true the executor should abort sibling tool executions in the same batch.
   * Useful for tools that detect an unsafe condition and need to stop other concurrent tasks.
   */
  siblingAbort?: boolean;
}

/** Global context provided to tool handlers at runtime */
export interface ToolContext {
  /** Reference to the registry calling the tool */
  registry?: any;
  /** Project root directory */
  projectRoot?: string;
  /** Optional callback to report incremental progress for long-running tools */
  onProgress?: (message: string, percent: number) => void;
}

export type ToolHandler = (args: Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
