import React from "react";
import { Box, Text } from "ink";

interface DiffPreviewProps {
  filePath: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  compact?: boolean;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({ filePath, diff, linesAdded, linesRemoved, compact }) => {
  const diffLines = diff.split("\n");
  const maxLines = compact ? 20 : 60;
  const truncated = diffLines.length > maxLines;
  const shown = truncated ? diffLines.slice(0, maxLines) : diffLines;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Text color="greenBright" bold>👽 {filePath}</Text>
        <Text dimColor>  </Text>
        <Text color="green">+{linesAdded}</Text>
        <Text dimColor> </Text>
        <Text color="red">-{linesRemoved}</Text>
      </Box>

      {/* Diff body */}
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {shown.map((line, i) => {
          const isAdd = line.startsWith("+");
          const isRem = line.startsWith("-");
          const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");

          if (isHeader) {
            return (
              <Text key={i} color="greenBright" dimColor>{line}</Text>
            );
          }

          const prefix = isAdd ? "+ " : isRem ? "- " : "  ";
          const body = line.slice(2);

          return (
            <Box key={i} paddingX={0}>
              <Text
                backgroundColor={isAdd ? "#0a3a1e" : isRem ? "#3b1616" : undefined}
                color={isAdd ? "#3fb950" : isRem ? "#f85149" : "gray"}
              >
                {prefix}{body}
              </Text>
            </Box>
          );
        })}

        {truncated && (
          <Text dimColor>... {diffLines.length - maxLines} more lines</Text>
        )}
      </Box>
    </Box>
  );
};
