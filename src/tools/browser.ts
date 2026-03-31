import type { ToolDefinition, ToolHandler } from "./types.js";
import { browserService } from "./browser_service.js";

export const browser_action_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "browser_action",
    description:
      "Perform browser automation tasks: navigate to URLs, click elements, fill forms, take screenshots, and extract page content. " +
      "Powered by Antigravity Pro engine for reliable web interaction.\n\n" +
      "Actions:\n" +
      "- 'navigate': Go to a URL\n" +
      "- 'screenshot': Capture the current page as an image\n" +
      "- 'click': Click an element by CSS selector or text\n" +
      "- 'type': Type text into an input field\n" +
      "- 'extract': Get text content and accessibility tree from the page\n" +
      "- 'evaluate': Run custom JavaScript on the page\n" +
      "- 'back': Go back in browser history\n" +
      "- 'forward': Go forward in browser history\n" +
      "- 'scroll': Scroll the page (up, down, top, bottom)\n" +
      "- 'status': Check if browser is running",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["navigate", "screenshot", "click", "type", "extract", "evaluate", "back", "forward", "scroll", "status"],
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
        direction: {
          type: "string",
          enum: ["up", "down", "top", "bottom"],
          description: "Scroll direction (for 'scroll' action). Defaults to 'down'.",
        },
        amount: {
          type: "integer",
          description: "Scroll amount in pixels (for 'scroll' action). Defaults to viewport height.",
        },
      },
      required: ["action"],
    },
  },
};

export const browser_action_handler: ToolHandler = async (args) => {
  const { action, url, selector, text, script, file_path, direction, amount } = args;

  try {
    const page = await browserService.getPage();
    let response: { content: string; reference?: string; isError?: boolean };

    switch (action) {
      case "navigate":
        if (!url) return { content: "URL required for 'navigate' action.", isError: true };
        await browserService.updateHUD(`Navigating to ${url}...`, "🧭");
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        const title = await page.title();
        await browserService.updateHUD(`Arrived at: ${title}`, "✅");
        response = { content: `Navigated to ${url}. Title: ${title}` };
        break;

      case "screenshot":
        await browserService.updateHUD("Capturing screenshot...", "📸");
        const screenshotPath = await browserService.screenshot(file_path as string);
        response = { content: `Screenshot saved to ${screenshotPath}`, reference: screenshotPath };
        break;

      case "click":
        if (selector) {
          await browserService.click(selector as string);
          response = { content: `Clicked selector: ${selector}` };
        } else if (text) {
          const textSelector = `text="${text}"`;
          await browserService.click(textSelector);
          response = { content: `Clicked text: ${text}` };
        } else {
          response = { content: "Selector or text required for 'click' action.", isError: true };
        }
        break;

      case "type":
        if (!selector || text === undefined) {
          return { content: "Selector and text required for 'type' action.", isError: true };
        }
        await browserService.type(selector as string, text as string);
        response = { content: `Typed into ${selector}` };
        break;

      case "extract":
        const extraction = await browserService.extractContent() as any;
        response = {
          content: `URL: ${extraction.url}\nTitle: ${extraction.title}\n\nInteractive View:\n${JSON.stringify(extraction.interactiveElements, null, 2)}`,
        };
        break;

      case "evaluate":
        if (!script) return { content: "Script required for 'evaluate' action.", isError: true };
        await browserService.updateHUD("Evaluating script...", "⚙️");
        const res = await page.evaluate(script as string);
        response = { content: `Evaluation result: ${JSON.stringify(res)}` };
        break;

      case "back":
        await browserService.updateHUD("Going back...", "🔙");
        await page.goBack();
        response = { content: `Went back.` };
        break;

      case "forward":
        await browserService.updateHUD("Going forward...", "🔜");
        await page.goForward();
        response = { content: `Went forward.` };
        break;

      case "scroll":
        const dir = (direction as any) || "down";
        const amt = (amount as number) || 500;
        await browserService.smoothScroll(dir, amt);
        response = { content: `Scrolled ${dir} by ${amt} pixels.` };
        break;

      case "status":
        const st = await browserService.ensureBrowser();
        response = { content: `Browser is running on context: ${st.page.url()}` };
        break;

      default:
        response = { content: `Unsupported action: ${action}`, isError: true };
    }

    if (!response.isError) {
      await new Promise(r => setTimeout(r, 800));
      await browserService.clearHUD();
    }
    return response;
  } catch (error: any) {
    await browserService.clearHUD();
    return { content: `Browser action failed: ${error.message}`, isError: true };
  }
};
