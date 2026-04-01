/**
 * TeammateSpinnerLine Component
 * Shows a single teammate's status with spinner animation
 * Inspired by Claude Code's TeammateSpinnerLine
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme.js";

interface TeammateSpinnerLineProps {
  name: string;
  status: "idle" | "running" | "done" | "error";
  activity?: string;
  tokenCount?: number;
  isSelected?: boolean;
  isLast?: boolean;
}

export const TeammateSpinnerLine: React.FC<TeammateSpinnerLineProps> = ({
  name,
  status,
  activity,
  tokenCount,
  isSelected = false,
  isLast = false,
}) => {
  const { theme } = useTheme();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
    }, 120);
    return () => clearInterval(timer);
  }, [status]);

  // Animated spinner characters
  const spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerChar = spinnerChars[frame % spinnerChars.length];

  // Tree characters
  const treeChar = isSelected
    ? isLast
      ? "╘═"
      : "╞═"
    : isLast
    ? "└─"
    : "├─";

  // Status icon
  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return <Text color={theme.warning}>{spinnerChar}</Text>;
      case "done":
        return <Text color={theme.success}>✓</Text>;
      case "error":
        return <Text color={theme.error}>✗</Text>;
      case "idle":
      default:
        return <Text dimColor>○</Text>;
    }
  };

  // Status color
  const getStatusColor = () => {
    switch (status) {
      case "running":
        return theme.warning;
      case "done":
        return theme.success;
      case "error":
        return theme.error;
      case "idle":
      default:
        return theme.textMuted;
    }
  };

  return (
    <Box flexDirection="row" paddingLeft={3}>
      {/* Selection indicator */}
      <Text color={isSelected ? "suggestion" : undefined} bold={isSelected}>
        {isSelected ? "▸" : " "}
      </Text>
      <Text dimColor={!isSelected}>{treeChar} </Text>

      {/* Name */}
      <Text color={isSelected ? "suggestion" : theme.text} bold={isSelected}>
        @{name}
      </Text>
      <Text dimColor={!isSelected}>: </Text>

      {/* Status */}
      {getStatusIcon()}
      <Text> </Text>

      {/* Activity or status text */}
      {status === "running" && activity ? (
        <Text color={getStatusColor()}>{activity}...</Text>
      ) : status === "done" ? (
        <Text color={getStatusColor()}>Done</Text>
      ) : status === "error" ? (
        <Text color={getStatusColor()}>Error</Text>
      ) : (
        <Text color={getStatusColor()}>Idle</Text>
      )}

      {/* Token count */}
      {tokenCount !== undefined && tokenCount > 0 && (
        <>
          <Text dimColor> • </Text>
          <Text dimColor>{tokenCount} tokens</Text>
        </>
      )}
    </Box>
  );
};