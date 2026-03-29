import type { ToolDefinition, ToolHandler } from "./types.js";

export const reflect_definition: ToolDefinition = {
  type: "function",
  function: {
    name: "reflect",
    description:
      "Stop and analyze WHY something is failing. Use when you encounter repeated errors, " +
      "test failures, or build issues. Forces structured root-cause analysis before continuing. " +
      "This prevents you from blindly retrying the same broken approach.",
    parameters: {
      type: "object",
      properties: {
        error_context: {
          type: "string",
          description: "The error output or failure context to analyze",
        },
        what_i_tried: {
          type: "string",
          description: "What approach/actions you already tried that failed",
        },
        hypothesis: {
          type: "string",
          description: "Your initial hypothesis about what might be wrong",
        },
      },
      required: ["error_context", "what_i_tried"],
    },
  },
};

export const reflect_handler: ToolHandler = async (args) => {
  const errorContext = (args.error_context as string) ?? "No error context provided";
  const whatITried = (args.what_i_tried as string) ?? "No approach described";
  const hypothesis = (args.hypothesis as string) ?? "No hypothesis provided";

  const analysis = `
## 🛑 Reflection Checkpoint

### Error Context
${errorContext.slice(0, 2000)}

### What Was Tried
${whatITried.slice(0, 1000)}

### Current Hypothesis
${hypothesis.slice(0, 500)}

### Reflection Checklist
Before continuing, verify:
- [ ] Is the error message telling you the REAL problem, or is it a symptom?
- [ ] Have you checked if the file/code you're editing actually exists where you think?
- [ ] Are there environment/config issues (missing deps, wrong versions)?
- [ ] Is your assumption about the codebase correct? (grep/read to verify)
- [ ] Have you tried a fundamentally different approach?

### Next Steps
1. Read the ACTUAL error carefully — look for file paths, line numbers
2. Grep/read the relevant code to verify your understanding
3. If 3+ attempts failed, step back and ask: "Is my entire approach wrong?"
4. Consider asking the user for context if the error is in unfamiliar territory

💡 Remember: The definition of insanity is doing the same thing and expecting different results.
`;

  return { content: analysis };
};
