/**
 * TeammateSpinnerTree Component
 * Shows multiple teammates in a tree structure
 * Inspired by Claude Code's TeammateSpinnerTree
 */

import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme.js";
import { TeammateSpinnerLine } from "./TeammateSpinnerLine.js";

interface Teammate {
  name: string;
  status: "idle" | "running" | "done" | "error";
  activity?: string;
  tokenCount?: number;
}

interface TeammateSpinnerTreeProps {
  teammates: Teammate[];
  selectedIndex?: number;
  leaderName?: string;
  leaderStatus?: "idle" | "running" | "done" | "error";
  leaderActivity?: string;
  leaderTokenCount?: number;
}

export const TeammateSpinnerTree: React.FC<TeammateSpinnerTreeProps> = ({
  teammates,
  selectedIndex = -1,
  leaderName = "team-lead",
  leaderStatus = "idle",
  leaderActivity,
  leaderTokenCount,
}) => {
  const { theme } = useTheme();

  // Check if all teammates are idle
  const allIdle = teammates.every((t) => t.status === "idle");

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Leader row */}
      <Box flexDirection="row" paddingLeft={3}>
        <Text
          color={selectedIndex === -1 ? "suggestion" : undefined}
          bold={selectedIndex === -1}
        >
          {selectedIndex === -1 ? "▸" : " "}
        </Text>
        <Text dimColor={selectedIndex !== -1}>
          {selectedIndex === -1 ? "╔═" : "┌─"}{" "}
        </Text>
        <Text
          bold={selectedIndex === -1}
          color={selectedIndex === -1 ? "suggestion" : theme.primary}
        >
          {leaderName}
        </Text>
        {leaderStatus === "running" && leaderActivity && (
          <Text dimColor>: {leaderActivity}...</Text>
        )}
        {leaderStatus === "idle" && allIdle && (
          <Text dimColor>: Idle</Text>
        )}
        {leaderTokenCount !== undefined && leaderTokenCount > 0 && (
          <Text dimColor> • {leaderTokenCount} tokens</Text>
        )}
        {selectedIndex === -1 && (
          <Text dimColor> • shift + ↑/↓ to select</Text>
        )}
      </Box>

      {/* Teammate rows */}
      {teammates.map((teammate, index) => (
        <TeammateSpinnerLine
          key={teammate.name}
          name={teammate.name}
          status={teammate.status}
          activity={teammate.activity}
          tokenCount={teammate.tokenCount}
          isSelected={selectedIndex === index}
          isLast={index === teammates.length - 1}
        />
      ))}

      {/* Hide row (only in selection mode) */}
      {selectedIndex >= 0 && (
        <Box flexDirection="row" paddingLeft={3}>
          <Text color={selectedIndex === teammates.length ? "suggestion" : undefined} bold={selectedIndex === teammates.length}>
            {selectedIndex === teammates.length ? "▸" : " "}
          </Text>
          <Text dimColor={selectedIndex !== teammates.length}>
            {selectedIndex === teammates.length ? "╘═" : "└─"}{" "}
          </Text>
          <Text bold={selectedIndex === teammates.length}>hide</Text>
          {selectedIndex === teammates.length && (
            <Text dimColor> • enter to collapse</Text>
          )}
        </Box>
      )}
    </Box>
  );
};