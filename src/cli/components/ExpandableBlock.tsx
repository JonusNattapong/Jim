import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";

interface ExpandableBlockProps {
  title: string;
  content: string;
  isDiff?: boolean;
  expanded?: boolean;
}

export const ExpandableBlock: React.FC<ExpandableBlockProps> = ({ title, content, isDiff, expanded: propExpanded }) => {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = localExpanded || propExpanded;

  const lines = content.split("\n");
  const isLarge = lines.length > 12;
  const showLines = isExpanded ? lines : (isLarge ? lines.slice(0, 12) : lines);

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={0}>
      <Box marginBottom={0} flexDirection="row" alignItems="center">
        <Text color={isDiff ? theme.success : theme.primary} bold>{isExpanded ? "▼" : "▶"} </Text>
        <Text bold color={isDiff ? theme.success : theme.primary}>
          {isDiff ? "FILE CHANGES" : title.toUpperCase()}
        </Text>
        {isLarge && (
           <Text dimColor italic> (Showing {showLines.length}/{lines.length} lines - press /o to toggle full view)</Text>
        )}
      </Box>

      <Box 
        flexDirection="column" 
        paddingX={1} 
        paddingY={0}
        borderStyle="single" 
        borderColor={theme.border}
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        marginLeft={1}
      >
        {showLines.map((line, i) => {
          if (isDiff) {
            const isAdd = line.startsWith("+");
            const isRem = line.startsWith("-");
            const isHunk = line.startsWith("@");
            let color = theme.textMuted;
            if (isAdd) color = theme.success;
            else if (isRem) color = theme.error;
            else if (isHunk) color = theme.primary;

            return (
              <Text key={i} color={color}>
                {line}
              </Text>
            );
          }
          return <Text key={i} color={theme.textMuted}>{line}</Text>;
        })}
        
        {isLarge && !isExpanded && (
          <Text color={theme.textMuted} dimColor>  ...</Text>
        )}
      </Box>
      
      {isLarge && (
        <Box marginLeft={2} marginTop={0}>
          <Text dimColor>Tip: Use </Text>
          <Text bold color={theme.primary}>/expand </Text>
          <Text dimColor>to see full content</Text>
        </Box>
      )}
    </Box>
  );
};
