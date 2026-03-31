import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

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
        <Text color={theme.success} bold>{filePath}</Text>
        <Text dimColor>  </Text>
        <Text color={theme.success}>+{linesAdded}</Text>
        <Text dimColor> </Text>
        <Text color={theme.error}>-{linesRemoved}</Text>
      </Box>

      {/* Diff body */}
      <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
        {shown.map((line, i) => {
          const isAdd = line.startsWith("+");
          const isRem = line.startsWith("-");
          const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");

          if (isHeader) {
            return (
              <Text key={i} color={theme.primary} dimColor>{line}</Text>
            );
          }

          const prefix = isAdd ? "+ " : isRem ? "- " : "  ";
          const body = line.slice(2);

          return (
            <Box key={i} paddingX={0}>
              <Text
                backgroundColor={isAdd ? theme.success : isRem ? theme.error : undefined}
                color={isAdd ? theme.inverse : isRem ? theme.textBright : theme.border}
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
