import React from "react";
import { Box, Text } from "ink";

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

const STATUS_LABEL: Record<TaskBoardItem["status"], string> = {
  pending: "pending",
  in_progress: "in progress",
  blocked: "blocked",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_COLOR: Record<TaskBoardItem["status"], "gray" | "yellow" | "red" | "green"> = {
  pending: "gray",
  in_progress: "yellow",
  blocked: "red",
  completed: "green",
  cancelled: "gray",
};

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

function statusGlyph(status: TaskBoardItem["status"]): string {
  switch (status) {
    case "completed":
      return "●";
    case "in_progress":
      return "◐";
    case "blocked":
      return "◌";
    case "cancelled":
      return "◦";
    default:
      return "○";
  }
}

function priorityAccent(priority: TaskBoardItem["priority"]): string {
  switch (priority) {
    case "high":
      return "!";
    case "low":
      return "-";
    default:
      return "·";
  }
}

interface TaskBoardProps {
  board: TaskBoardData;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ board }) => {
  const remaining = Math.max(board.total - board.completed, 0);

  return (
    <Box borderStyle="round" borderColor="greenBright" paddingX={1} paddingY={0} marginTop={1} marginLeft={4} flexDirection="column">
      <Box justifyContent="space-between">
        <Text color="greenBright">{board.completed} of {board.total} anomalies resolved</Text>
        <Text dimColor>{board.title}</Text>
      </Box>

      {board.items.map((item) => (
        <Box key={item.index} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={STATUS_COLOR[item.status]}>{statusGlyph(item.status)}</Text>
            <Text> </Text>
            <Text dimColor>{item.index + 1}.</Text>
            <Text> </Text>
            <Text color={item.priority === "high" ? "red" : item.priority === "low" ? "blue" : "magentaBright"}>{priorityAccent(item.priority)}</Text>
            <Text> </Text>
            <Text bold color={item.status === "completed" ? "gray" : "white"}>{item.content}</Text>
          </Box>

          <Box marginLeft={4}>
            <Text color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Text>
            {item.owner ? <Text dimColor>{`  owner ${item.owner}`}</Text> : null}
            {item.dependsOn && item.dependsOn.length > 0 ? <Text dimColor>{`  depends ${item.dependsOn.map((value) => value + 1).join(", ")}`}</Text> : null}
          </Box>

          {item.acceptanceCriteria ? (
            <Box marginLeft={4}>
              <Text dimColor>done when {item.acceptanceCriteria}</Text>
            </Box>
          ) : null}

          {item.notes ? (
            <Box marginLeft={4}>
              <Text dimColor>{item.notes}</Text>
            </Box>
          ) : null}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>{remaining} remaining</Text>
        <Text dimColor>{`  ${board.inProgress} in progress`}</Text>
        <Text dimColor>{`  ${board.blocked} blocked`}</Text>
      </Box>
    </Box>
  );
};
