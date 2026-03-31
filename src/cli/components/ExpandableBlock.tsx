import React, { useState } from "react";
import { Box, Text, useFocus, useInput } from "ink";
import { theme } from "../theme.js";

export const ExpandableBlock: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  const [expanded, setExpanded] = useState(false);
  const { isFocused } = useFocus();

  useInput((input, key) => {
    if (key.return || key.rightArrow || key.leftArrow) {
      setExpanded((e) => !e);
    }
  }, { isActive: isFocused });

  const cleanContent = content || "";
  const lines = cleanContent.split("\n");
  const isLarge = lines.length > 20;

  if (!isLarge) {
    return (
      <Box flexDirection="column" marginLeft={0} paddingTop={0}>
        <Text dimColor>↳ {cleanContent}</Text>
      </Box>
    );
  }

  return (
    <Box 
      flexDirection="column" 
      borderStyle={isFocused ? "bold" : "round"} 
      borderColor={isFocused ? theme.warning : theme.border} 
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
         <Text color={isFocused ? theme.warning : theme.primary} bold>{title}</Text>
         <Text color={isFocused ? theme.warning : theme.border}>
           {expanded ? "[-] Press Enter to collapse" : `[+] ${(lines.length - 10).toLocaleString()} lines hidden (Press Enter to expand)`}
         </Text>
      </Box>
      {expanded ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{cleanContent}</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{lines.slice(0, 10).join("\n")}</Text>
          <Text dimColor>...</Text>
        </Box>
      )}
    </Box>
  );
};
