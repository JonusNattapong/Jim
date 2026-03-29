import type { ToolDefinition, ToolHandler } from "./types.js";

export const browser_action_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "browser_action",
    description:
      "Perform browser automation tasks: navigate to URLs, click elements, fill forms, take screenshots, and extract page content. " +
      "This tool dynamically loads a Puppeteer MCP server if not already connected. " +
      "Inspired by browser-use patterns for AI-driven web automation.\n\n" +
      "Actions:\n" +
      "- 'navigate': Go to a URL\n" +
      "- 'screenshot': Capture the current page as an image\n" +
      "- 'click': Click an element by CSS selector or text\n" +
      "- 'type': Type text into an input field\n" +
      "- 'extract': Get text content from the page\n" +
      "- 'evaluate': Run custom JavaScript on the page\n" +
      "- 'back': Go back in browser history\n" +
      "- 'status': Check if browser is running",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["navigate", "screenshot", "click", "type", "extract", "evaluate", "back", "status"],
          description: "The browser action to perform.",
        },
        url: {
          type: "string",
          description: "URL to navigate to (for 'navigate' action).",
        },
        selector: {
          type: "string",
          description: "CSS selector for the target element (for 'click', 'type', 'extract' actions).",
        },
        text: {
          type: "string",
          description: "Text to type (for 'type' action) or click text content (for 'click' action).",
        },
        script: {
          type: "string",
          description: "JavaScript code to evaluate in the page context (for 'evaluate' action).",
        },
        file_path: {
          type: "string",
          description: "File path to save screenshot (for 'screenshot' action).",
        },
      },
      required: ["action"],
    },
  },
};

// This handler is a proxy that delegates to MCP puppeteer tools
// It's actually handled in the agent loop like spawn_agent
export const browser_action_handler: ToolHandler = async (_args) => {
  return {
    content: "browser_action is handled by the agent loop directly.",
    isError: false,
  };
};
