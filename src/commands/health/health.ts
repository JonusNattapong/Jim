import type { CommandHandler } from "../types.js";
import { runHealthCheck, formatHealthCheck } from "../../services/project-health.js";
import { getCwd } from "../../utils/get-cwd.js";

export const health_handler: CommandHandler = async (args) => {
  try {
    const projectPath = getCwd();
    const { results, healthy } = await runHealthCheck(projectPath);

    const formatted = formatHealthCheck(results);

    return {
      type: "text",
      value: formatted,
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    return {
      type: "text",
      value: `❌ Health check failed: ${errorMsg}`,
    };
  }
};
