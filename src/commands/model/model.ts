import type { LocalCommandCall } from "../types.js";

const call: LocalCommandCall = async (args, context) => {
  const [action] = args.trim().split(/\s+/);

  if (!action || action === "list" || action === "?") {
    const current = context.agent?.getModel?.() ?? "unknown";
    const available = ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"];
    return {
      type: "text",
      value: `**Current Model**: ${current}\n\n**Available Models**:\n${available.map((m) => `- ${m}`).join("\n")}`,
    };
  }

  try {
    context.agent?.setModel?.(action);
    return {
      type: "text",
      value: `✅ Model switched to **${action}**`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      type: "error",
      value: `Failed to switch model: ${msg}`,
    };
  }
};

export { call };
