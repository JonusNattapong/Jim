import React, { useState } from "react";
import { Box, Text, useFocus, useInput } from "ink";

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
  const isLarge = lines.length > 5;

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
      borderColor={isFocused ? "yellow" : "gray"} 
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
         <Text color={isFocused ? "yellow" : "cyan"} bold>{title}</Text>
         <Text color={isFocused ? "yellow" : "gray"}>
           {expanded ? "[-] กด Enter เพื่อพับเก็บ" : `[+] ซ่อนอยู่ ${(lines.length - 5).toLocaleString()} บรรทัด (กด Enter เพื่อกาง)`}
         </Text>
      </Box>
      {expanded ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{cleanContent}</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{lines.slice(0, 5).join("\n")}</Text>
          <Text dimColor>...</Text>
        </Box>
      )}
    </Box>
  );
};
