import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";
import type { SubAgentStatus } from "../../agent/subagent.js";

interface SubAgentCardProps {
  status: SubAgentStatus;
}

export const SubAgentCard: React.FC<SubAgentCardProps> = ({ status }) => {
  const [frame, setFrame] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useInput((input) => {
    if (input === " " && status.status !== "running" && status.result) {
      setExpanded((p) => !p);
    }
  });

  useEffect(() => {
    if (status.status === "running") {
      const t = setInterval(() => setFrame((f) => f + 1), 100);
      return () => clearInterval(t);
    }
  }, [status.status]);

  // Premium spinner frames
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const currentSpinner = spinnerFrames[frame % spinnerFrames.length];

  const roleLabels: Record<string, string> = {
    explore: "Explorer",
    general: "Assistant",
    planner: "Planner",
    executor: "Executor",
    reviewer: "Reviewer",
    web_surfer: "Researcher",
    browser_agent: "Browser Agent",
  };

  const roleLabel = roleLabels[status.role] || "Sub-Agent";
  const isRunning = status.status === "running";
  const isError = status.status === "error";

  // Match the visual style from the reference image
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={0} marginLeft={0}>
      {/* Header section with node icon */}
      <Box marginBottom={0} marginLeft={0}>
        <Text color={theme.primary}>☍ </Text>
        <Text bold color={theme.primary}>Jim</Text>
        <Text color={theme.textBright}> wants to use subagents:</Text>
      </Box>

      {/* Main Card Container */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isRunning ? theme.primary : isError ? theme.error : theme.border}
        paddingX={1}
        paddingY={0}
        minWidth={70}
        marginLeft={2}
      >
        <Box flexDirection="row">
          {/* Status Icon / Spinner */}
          <Box marginRight={1}>
            {isRunning ? (
              <Text color={theme.primary}>{currentSpinner}</Text>
            ) : isError ? (
              <Text color={theme.error}>✖</Text>
            ) : (
              <Text color={theme.success}>✔</Text>
            )}
          </Box>

          {/* Task Description */}
          <Box flexDirection="column" flexShrink={1}>
            <Box flexDirection="row" marginBottom={0}>
               <Text bold color={theme.textMuted} dimColor>GOAL </Text>
            </Box>
            <Text color={theme.textBright} bold={isRunning}>
              {status.task.length > 250 && !expanded ? status.task.slice(0, 250) + "..." : status.task}
              {status.task.length > 250 && (
                <Text color={theme.primaryBright}>
                  {" "}{expanded ? "(Show less)" : "(Show more)"}
                </Text>
              )}
            </Text>
          </Box>
        </Box>

        {/* Metrics Row (Tools, Tokens, Cost) */}
        <Box marginTop={0} flexDirection="row">
          <Text color={theme.textMuted}>
            {status.toolsCalled} tools called · {status.tokensUsed.toLocaleString()} tokens · ${status.cost.toFixed(2)}
          </Text>
        </Box>

        {/* Show Output Button / Result Content */}
        {!isRunning && status.result && (
          <Box marginTop={0} flexDirection="column">
            <Box flexDirection="row">
               <Text color={theme.textMuted} bold={expanded}>
                 {expanded ? "▼" : "▶"} Show output
               </Text>
            </Box>
            {expanded && (
               <Box marginTop={1} paddingX={1} borderStyle="round" borderColor={theme.border}>
                 <Text color={theme.textBright}>
                   {status.result}
                 </Text>
               </Box>
            )}
          </Box>
        )}

        {/* Current Tool Status (when running) */}
        {isRunning && status.currentTool && (
           <Box marginTop={1} paddingX={1}>
             <Text color={theme.primaryBright} bold>● </Text>
             <Text color={theme.textBright}>
               {status.currentTool}...
             </Text>
           </Box>
        )}
      </Box>
    </Box>
  );
};
