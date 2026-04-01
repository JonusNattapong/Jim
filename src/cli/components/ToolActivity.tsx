import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";
import { toolLabel } from "../tool-labels.js";
import { TaskBoard, parseTaskBoard } from "./TaskBoard.js";
import { ExpandableBlock } from "./ExpandableBlock.js";
import { DiffViewer } from "./DiffViewer.js";

export interface ToolCallEntry {
  name: string;
  args: string;
  status: "running" | "pending_approval" | "awaiting_choice" | "done" | "error";
  result?: string;
  rawResult?: string;
  diff?: string;
}

interface ToolActivityProps {
  calls: ToolCallEntry[];
  isExpanded?: boolean;
}

const AnimatedScanner: React.FC<{ name: string; args: string }> = ({ name, args }) => {
  const [frame, setFrame] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => f + 1), 120);
    return () => clearInterval(t);
  }, []);

  const width = 15;
  const pos = frame % (width * 2 - 2);
  const x = pos < width ? pos : width * 2 - 2 - pos;
  const dir = pos < width ? 1 : -1;

  const bar = Array(width).fill(" ");
  bar[x] = "█";
  if (x - dir >= 0 && x - dir < width) bar[x - dir] = "▓";
  if (x - 2 * dir >= 0 && x - 2 * dir < width) bar[x - 2 * dir] = "▒";

  return (
    <Box>
      <Text color={theme.primary} bold>[{bar.join("")}] </Text>
      <Text color={theme.primary}>executing ➡ </Text>
      <Text color={theme.text} bold>{toolLabel(name)} </Text>
      <Text dimColor>{args.slice(0, 40)}{args.length > 40 ? "..." : ""}</Text>
    </Box>
  );
};

const ToolActivityComponent: React.FC<ToolActivityProps> = ({ calls }) => {
  const { theme } = useTheme();
  if (calls.length === 0) return null;

  const [isExpanded, setIsExpanded] = useState(false);

  const renderCall = (call: ToolCallEntry, i: number) => {
    const board = call.name === "todo_write" && call.rawResult ? parseTaskBoard(call.rawResult) : null;
    const isShell = ["run_command", "powershell", "git_command"].includes(call.name);

    // Parse args if it's a JSON string
    let displayArgs = call.args;
    try {
      const parsed = JSON.parse(call.args);
      displayArgs = parsed.CommandLine || parsed.command || parsed.args || call.args;
    } catch (e) { }

    return (
      <Box key={i} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
        {call.status === "running" ? (
          <Box>
            <Text color={theme.error} bold>* </Text>
            <Text color={theme.error} bold>Working... </Text>
            <Text dimColor>(thinking)</Text>
          </Box>
        ) : call.status === "pending_approval" || call.status === "awaiting_choice" ? (
          <Box>
            <Text color={theme.warning}>{call.status === "pending_approval" ? "*" : "?"}</Text>
            <Text> </Text>
            <Text color={theme.warning} bold>{toolLabel(call.name)}</Text>
            <Text dimColor> {call.status === "pending_approval" ? "waiting for approval" : "awaiting choice"}</Text>
          </Box>
        ) : (
          <Box>
            {isShell ? (
              <Box flexDirection="column">
                <Box>
                  <Text color={theme.success}>● </Text>
                  <Text bold>{toolLabel(call.name)}(</Text>
                  <Text color={theme.textMuted}>{displayArgs}</Text>
                  <Text bold>)</Text>
                </Box>
                {call.rawResult && (
                  <Box flexDirection="column" marginLeft={2}>
                    {(() => {
                      const lines = call.rawResult.split("\n");
                      const showLines = lines.slice(0, 3);
                      const remaining = lines.length - 3;
                      return (
                        <Box flexDirection="column">
                          {showLines.map((line, j) => (
                            <Text key={j} color={theme.textMuted}>└ {line}</Text>
                          ))}
                          {remaining > 0 && (
                            <Text color={theme.textMuted} dimColor>  ... +{remaining} lines (ctrl+o to expand)</Text>
                          )}
                        </Box>
                      );
                    })()}
                  </Box>
                )}
              </Box>
            ) : (
              <Box>
                <Text dimColor>  </Text>
                {call.status === "error" ? (
                  <Text color={theme.error}>✗</Text>
                ) : (
                  <Text color={theme.success}>✓</Text>
                )}
                <Text> </Text>
                <Text color={call.status === "error" ? theme.error : theme.success} bold>{toolLabel(call.name)}</Text>
                <Text dimColor> {displayArgs.slice(0, 60)}{displayArgs.length > 60 ? "..." : ""}</Text>
              </Box>
            )}
          </Box>
        )}

        {call.rawResult && !board && !isShell ? (
          <Box marginLeft={4}>
            <ExpandableBlock
              title={`Output: ${toolLabel(call.name)}`}
              content={call.rawResult}
              expanded={isExpanded}
            />
          </Box>
        ) : call.result && !board && !isShell ? (
          <Box marginLeft={4}>
            <Text dimColor>↳ {call.result.slice(0, 100).replace(/\n/g, " ")}{call.result.length > 100 ? "..." : ""}</Text>
          </Box>
        ) : null}

        {board && call.status !== "running" && call.status !== "pending_approval" ? (
          <TaskBoard board={board} />
        ) : null}

        {call.diff && (
          <Box flexDirection="column" marginLeft={0} marginTop={1}>
            <DiffViewer
              diff={call.diff}
              collapsed={!isExpanded}
            />
          </Box>
        )}
      </Box>
    );
  };

  // Logical Grouping (Pillar 18)
  // If more than 3 tools, collapse them into a group
  if (calls.length > 3 && !isExpanded) {
    const successCount = calls.filter(c => c.status === "done").length;
    const errorCount = calls.filter(c => c.status === "error").length;
    const running = calls.some(c => c.status === "running");
    const summary = calls.slice(0, 5).map(c => toolLabel(c.name)).join(", ") + (calls.length > 5 ? "..." : "");

    return (
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Box flexDirection="row">
          <Text color={theme.primary} bold>⊞ </Text>
          <Text color={theme.primary}>Executed {calls.length} tools </Text>
          <Text dimColor>({summary}) </Text>
          <Text color={theme.success}>{successCount > 0 ? `✓ ${successCount} ` : ""}</Text>
          <Text color={theme.error}>{errorCount > 0 ? `✗ ${errorCount} ` : ""}</Text>
          {running && <Text color={theme.warning} italic> [running...]</Text>}
        </Box>
        <Box marginLeft={2} marginTop={0}>
          <Text color={theme.border} dimColor>Press </Text>
          <Text color={theme.primary} bold italic>expand </Text>
          <Text color={theme.border} dimColor>in message to see details</Text>
        </Box>
        {/* We reuse Expandable block logic by letting the user expand through the parent */}
        <Box marginTop={1}>
          <ExpandableBlock
            title={`View ${calls.length} Tool Operations`}
            content={calls.map(c => `${c.status === "done" ? "✓" : "✗"} ${toolLabel(c.name)}: ${c.args}`).join("\n")}
            expanded={isExpanded}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {calls.map((call, i) => renderCall(call, i))}
    </Box>
  );
};

export const ToolActivity = React.memo(ToolActivityComponent);
