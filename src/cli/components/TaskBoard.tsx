import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface TaskBoardItem {
  index: number;
  content: string;
  status: "pending" | "in_progress" | "blocked" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
  owner?: string;
  dependsOn?: number[];
  acceptanceCriteria?: string;
  notes?: string;
}

export interface TaskBoardData {
  title: string;
  items: TaskBoardItem[];
  completed: number;
  inProgress: number;
  blocked: number;
  total: number;
}

function parsePriority(token: string): TaskBoardItem["priority"] {
  if (token === "[!]") return "high";
  if (token === "[_]") return "low";
  return "medium";
}

export function parseTaskBoard(content: string): TaskBoardData | null {
  const normalized = content.replace(/\r/g, "");
  const lines = normalized.split("\n");
  const titleLine = lines.find((line) => line.trim().endsWith(":"));

  if (!titleLine || !/^.+task/i.test(titleLine.trim())) {
    return null;
  }

  const items: TaskBoardItem[] = [];
  let currentItem: TaskBoardItem | null = null;

  for (const line of lines) {
    const itemMatch = line.match(/^\s*(\d+)\.\s+[○●◌✓✗]\s+((?:\[!\]|\[_\]|\s{3}))\s(.+)\s\[(pending|in_progress|blocked|completed|cancelled)\]\s*$/);
    if (itemMatch) {
      currentItem = {
        index: Number(itemMatch[1]),
        priority: parsePriority(itemMatch[2]),
        content: itemMatch[3],
        status: itemMatch[4] as TaskBoardItem["status"],
      };
      items.push(currentItem);
      continue;
    }

    if (!currentItem) {
      continue;
    }

    const ownerMatch = line.match(/^\s+owner:\s(.+)$/);
    if (ownerMatch) {
      currentItem.owner = ownerMatch[1];
      continue;
    }

    const dependsOnMatch = line.match(/^\s+depends_on:\s(.+)$/);
    if (dependsOnMatch) {
      currentItem.dependsOn = dependsOnMatch[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
      continue;
    }

    const acceptanceMatch = line.match(/^\s+acceptance:\s(.+)$/);
    if (acceptanceMatch) {
      currentItem.acceptanceCriteria = acceptanceMatch[1];
      continue;
    }

    const notesMatch = line.match(/^\s+notes:\s(.+)$/);
    if (notesMatch) {
      currentItem.notes = notesMatch[1];
    }
  }

  if (items.length === 0) {
    return null;
  }

  const progressMatch = normalized.match(/Progress:\s*(\d+)\/(\d+)\s+done,\s*(\d+)\s+in progress,\s*(\d+)\s+blocked/i);
  const completed = progressMatch ? Number(progressMatch[1]) : items.filter((item) => item.status === "completed").length;
  const total = progressMatch ? Number(progressMatch[2]) : items.length;
  const inProgress = progressMatch ? Number(progressMatch[3]) : items.filter((item) => item.status === "in_progress").length;
  const blocked = progressMatch ? Number(progressMatch[4]) : items.filter((item) => item.status === "blocked").length;

  return {
    title: titleLine.trim().slice(0, -1),
    items,
    completed,
    inProgress,
    blocked,
    total,
  };
}

export const TaskBoard: React.FC<{ board: TaskBoardData }> = ({ board }) => {
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={0}>
      {/* Premium Header: Claude Style */}
      <Box marginBottom={0}>
        <Text color={theme.success} bold>● </Text>
        <Text bold>{board.title}</Text>
      </Box>

      {/* Task List: Borderless, Compact */}
      {board.items.map((item) => {
        const isInProgress = item.status === "in_progress";
        const isDone = item.status === "completed";
        const isBlocked = item.status === "blocked";
        
        let glyph = "[ ]";
        if (isDone) glyph = "[x]";
        if (isBlocked) glyph = "[!]";
        
        return (
          <Box key={item.index} marginLeft={2}>
            {isInProgress ? (
              <Text color={theme.warning} bold>* </Text>
            ) : (
              <Box width={2}>
                 <Text color={theme.textMuted} dimColor>{isDone ? "✓" : " "}</Text>
              </Box>
            )}
            
            <Box flexDirection="column">
              <Box>
                <Text color={isDone ? theme.textMuted : theme.text} strikethrough={isDone}>
                  {item.content}
                </Text>
                {item.priority === "high" && !isDone && (
                  <Text color={theme.error} bold> [!!]</Text>
                )}
              </Box>
              
              {/* Optional details (only if important) */}
              {(item.notes || item.owner) && !isDone && (
                <Box marginLeft={2}>
                   <Text dimColor italic color={theme.textMuted}>
                     {item.owner ? `@${item.owner} ` : ""}
                     {item.notes ? `(${item.notes})` : ""}
                   </Text>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
