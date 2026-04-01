import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

interface ThoughtProcessProps {
  content: string;
  isStreaming?: boolean;
  elapsed?: number;
  tokens?: number;
}

export const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ content, isStreaming, elapsed, tokens }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (!isStreaming) return;
    const t = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(t);
  }, [isStreaming]);

  if (!content) return null;

  const lines = content.split("\n");
  const maxLines = 10;
  const truncated = lines.length > maxLines;
  const shown = truncated ? lines.slice(-maxLines) : lines;
  
  const displayTime = elapsed != null && elapsed > 0 
    ? (elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`)
    : "";

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={0}>
      {/* Label: Claude Style "Thought for Xs >" */}
      <Box paddingX={0}>
        <Text color={theme.border} bold>● </Text>
        <Text color={theme.textMuted}>Thought for </Text>
        <Text color={theme.textMuted} bold>{displayTime || "..."}</Text>
        <Text color={theme.textMuted}> {isExpanded ? "⌄" : "›"}</Text>
        
        {isStreaming && (
          <Text color={theme.border}> {cursor ? "▋" : " "}</Text>
        )}
      </Box>

      {/* Content - faded gray, shows when expanded */}
      {isExpanded && (
        <Box flexDirection="column" marginLeft={4} marginTop={0} borderStyle={undefined} paddingX={0}>
          {truncated && (
            <Text dimColor italic color={theme.textMuted}>... earlier thinking hidden</Text>
          )}
          {shown.map((line, i) => (
            <Text key={i} color={theme.textMuted} dimColor italic>
              {line || " "}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
