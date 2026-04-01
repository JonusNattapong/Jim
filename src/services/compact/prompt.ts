/**
 * Context Compaction Prompt for Jim
 * Based on ClaudeCode Prompt Engineering techniques
 * 
 * Used when context window is full and needs summarization
 */

/**
 * Critical preamble - prevents tool calls during compaction
 */
export const COMPACT_NO_TOOLS_PREAMBLE = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.
- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- You already have all the context you need in the conversation above.
- Tool calls will be REJECTED and will waste your only turn — you will fail the task.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.`;

/**
 * Analysis block instructions - scratchpad for the model
 */
export const COMPACT_ANALYSIS_INSTRUCTIONS = `Before providing your final summary, wrap your analysis in <analysis> tags:

1. Chronologically analyze each message and section in the conversation
2. Identify key technical concepts discussed
3. Note all files that were read, created, or modified (with full paths)
4. Track errors encountered and how they were fixed
5. Identify any pending tasks or open questions
6. Note the current state of work — what is in progress or complete

Double-check for technical accuracy and completeness. Missing critical details will harm the user's workflow.`;

/**
 * Summary structure - 9 sections format
 */
export const COMPACT_SUMMARY_STRUCTURE = `Now provide your final summary in a <summary> block with these 9 sections:

## 1. Primary Request and Intent
What did the user originally ask for? What is the goal?

## 2. Key Technical Concepts
What technical ideas, patterns, or concepts were central to this conversation?

## 3. Files and Code Sections
List all files that were read, created, or modified. Include relevant code snippets if they represent the final state or important decisions.

## 4. Errors and Fixes
What errors occurred and how were they resolved?

## 5. Problem Solving Approach
What strategies were tried? What worked and what didn't?

## 6. All User Messages (non-tool-result)
Preserve the verbatim content of each user message (not tool results).

## 7. Pending Tasks
What tasks were started but not completed? What still needs work?

## 8. Current Work
What is the current state? What was the last action taken?

## 9. Optional Next Step
If there's a clear next step, provide it with verbatim quotes from the user's instructions that indicate what should happen next.`;

/**
 * Complete compaction prompt
 */
export function buildCompactionPrompt(): string {
  return [
    COMPACT_NO_TOOLS_PREAMBLE,
    "",
    COMPACT_ANALYSIS_INSTRUCTIONS,
    "",
    COMPACT_SUMMARY_STRUCTURE,
  ].join("\n");
}

/**
 * Post-compact injection message
 * Added to context after compaction to inform the model
 */
export function buildPostCompactMessage(suppressFollowUpQuestions = true): string {
  const baseMessage = `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.`;
  
  if (suppressFollowUpQuestions) {
    return `${baseMessage}

Continue the conversation from where it left off without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.`;
  }
  
  return baseMessage;
}

/**
 * Parse compacted summary from model response
 */
export function parseCompactedSummary(response: string): {
  analysis: string | null;
  summary: string | null;
} {
  const analysisMatch = response.match(/<analysis>([\s\S]*?)<\/analysis>/);
  const summaryMatch = response.match(/<summary>([\s\S]*?)<\/summary>/);
  
  return {
    analysis: analysisMatch?.[1]?.trim() ?? null,
    summary: summaryMatch?.[1]?.trim() ?? null,
  };
}

/**
 * Format compacted summary for injection into context
 */
export function formatCompactSummaryForContext(summary: string): string {
  return `## Previous Conversation Summary\n\n${summary}`;
}

/**
 * Check if a response contains the required XML tags
 */
export function validateCompactResponse(response: string): {
  valid: boolean;
  hasAnalysis: boolean;
  hasSummary: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const hasAnalysis = response.includes("<analysis>") && response.includes("</analysis>");
  const hasSummary = response.includes("<summary>") && response.includes("</summary>");
  
  if (!hasAnalysis) {
    errors.push("Missing <analysis> block");
  }
  if (!hasSummary) {
    errors.push("Missing <summary> block");
  }
  
  // Check for tool calls (should not be present)
  const hasToolCalls = response.includes('"tool_calls"') || 
                       response.includes("tool_call_id") ||
                       response.includes("function");
  
  if (hasToolCalls) {
    errors.push("Response contains tool calls (should be text only)");
  }
  
  return {
    valid: hasAnalysis && hasSummary && !hasToolCalls,
    hasAnalysis,
    hasSummary,
    errors,
  };
}
