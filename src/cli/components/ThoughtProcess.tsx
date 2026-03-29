import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface ThoughtProcessProps {
  content: string;
  isStreaming?: boolean;
  elapsed?: number;
}

export const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ content, isStreaming, elapsed }) => {
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (!isStreaming) return;
    const t = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(t);
  }, [isStreaming]);

  if (!content) return null;

  const lines = content.split("\n");
  const maxLines = 30;
  const truncated = lines.length > maxLines;
  const shown = truncated ? lines.slice(-maxLines) : lines;

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      {/* Label */}
      <Box>
        <Text color="gray" bold>thinking</Text>
        {elapsed != null && elapsed > 0 && (
          <Text dimColor> ({elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`})</Text>
        )}
        {isStreaming && (
          <Text color="gray"> {cursor ? "▋" : " "}</Text>
        )}
      </Box>

      {/* Content - faded gray */}
      <Box flexDirection="column" marginLeft={1} borderStyle="round" borderColor="#333333" paddingX={1}>
        {truncated && (
          <Text dimColor italic>... {lines.length - maxLines} earlier lines hidden</Text>
        )}
        {shown.map((line, i) => (
          <Text key={i} color="#666666" italic>
            {line || " "}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
