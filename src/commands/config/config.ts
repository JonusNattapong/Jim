import type { LocalCommandCall } from "../types.js";

const call: LocalCommandCall = async (args, context) => {
  const parts = args.trim().split(/\s+/);
  const [key, ...valueParts] = parts;
  const value = valueParts.join(" ");

  // View all config
  if (!key) {
    return {
      type: "text",
      value: `**Jim Configuration**\n\nUsage: /config <key> [value]\n\n**Current Settings**:\n- model: ${context.agent?.getModel?.() ?? "unknown"}\n- permissionMode: ${context.agent?.getPermissionMode?.() ?? "default"}\n- projectRoot: ${context.projectRoot ?? "not set"}`,
    };
  }

  // View specific config
  if (!value) {
    const val = getConfigValue(key, context);
    return {
      type: "text",
      value: `**${key}**: ${val}`,
    };
  }

  // Set config value
  try {
    setConfigValue(key, value, context);
    return {
      type: "text",
      value: `✅ Config updated: **${key}** = \`${value}\``,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      type: "error",
      value: `Failed to update config: ${msg}`,
    };
  }
};

function getConfigValue(key: string, context: CommandContext): string {
  switch (key) {
    case "model":
      return context.agent?.getModel?.() ?? "unknown";
    case "permissionMode":
      return context.agent?.getPermissionMode?.() ?? "default";
    case "projectRoot":
      return context.projectRoot ?? "not set";
    case "sessionId":
      return context.sessionId ?? "none";
    default:
      return "unknown key";
  }
}

function setConfigValue(
  key: string,
  value: string,
  context: any
): void {
  if (key === "model") {
    context.agent?.setModel?.(value);
  } else if (key === "permissionMode") {
    context.agent?.setPermissionMode?.(value);
  } else {
    throw new Error(`Cannot set ${key}`);
  }
}

interface CommandContext {
  agent?: any;
  projectRoot?: string;
  sessionId?: string;
}

export { call };
