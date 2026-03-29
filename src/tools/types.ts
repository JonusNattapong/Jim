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
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
