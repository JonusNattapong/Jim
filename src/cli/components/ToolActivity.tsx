import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { TaskBoard, parseTaskBoard } from "./TaskBoard.js";
import { ExpandableBlock } from "./ExpandableBlock.js";

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
}

const AnimatedScanner: React.FC<{ name: string; args: string }> = ({ name, args }) => {
  const [frame, setFrame] = useState(0);

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
      <Text color={theme.text} bold>{name} </Text>
      <Text dimColor>{args.slice(0, 40)}{args.length > 40 ? "..." : ""}</Text>
    </Box>
  );
};

export const ToolActivity: React.FC<ToolActivityProps> = ({ calls }) => {
  if (calls.length === 0) return null;

  const renderPending = (call: ToolCallEntry) => {
    if (call.status === "pending_approval") {
      return (
        <Box>
          <Text color={theme.warning}>*</Text>
          <Text> </Text>
          <Text color={theme.warning} bold>{call.name}</Text>
          <Text dimColor> waiting for approval</Text>
        </Box>
      );
    }

    return (
      <Box>
        <Text color={theme.primary}>•</Text>
        <Text> </Text>
        <Text color={theme.primary} bold>{call.name}</Text>
        <Text dimColor> awaiting transmission</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {calls.map((call, i) => {
        const board = call.name === "todo_write" && call.rawResult ? parseTaskBoard(call.rawResult) : null;

        return (
          <Box key={i} flexDirection="column">
            {call.status === "running" ? (
              <AnimatedScanner name={call.name} args={call.args} />
            ) : call.status === "pending_approval" || call.status === "awaiting_choice" ? (
              renderPending(call)
            ) : (
              <Box>
                <Text dimColor>  </Text>
                {call.status === "error" ? (
                  <Text color={theme.error}>✗</Text>
                ) : (
                  <Text color={theme.success}>✓</Text>
                )}
                <Text> </Text>
                <Text color={call.status === "error" ? theme.error : theme.success} bold>{call.name}</Text>
                <Text dimColor> {call.args.slice(0, 60)}{call.args.length > 60 ? "..." : ""}</Text>
              </Box>
            )}

            {call.rawResult && !board ? (
              <Box marginLeft={4}>
                <ExpandableBlock title={`Output: ${call.name}`} content={call.rawResult} />
              </Box>
            ) : call.result && !board ? (
              <Box marginLeft={4}>
                <Text dimColor>↳ {call.result.slice(0, 100).replace(/\n/g, " ")}{call.result.length > 100 ? "..." : ""}</Text>
              </Box>
            ) : null}

            {board && call.status !== "running" && call.status !== "pending_approval" && call.status !== "awaiting_choice" ? (
              <TaskBoard board={board} />
            ) : null}

            {call.diff && (
              <Box flexDirection="column" marginLeft={2} marginTop={1} borderStyle="round" borderColor={theme.border} paddingX={1}>
                {call.diff.split("\n").map((line, j) => {
                  const isAdd = line.startsWith("+");
                  const isRem = line.startsWith("-");
                  const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                  
                  if (isHeader) {
                    return <Text key={j} color={theme.primary} dimColor>{line}</Text>;
                  }

                  return (
                    <Box key={j} paddingX={1} backgroundColor={isAdd ? theme.success : isRem ? theme.error : undefined}>
                      <Text color={isAdd ? theme.inverse : isRem ? theme.textBright : theme.border}>
                        {line}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
