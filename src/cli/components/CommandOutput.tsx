import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

export interface CommandOutputEntry {
  type: "success" | "error" | "info" | "list";
  content: string;
  items?: string[];
}

interface CommandOutputProps {
  output: CommandOutputEntry | null;
}

export const CommandOutput: React.FC<CommandOutputProps> = ({ output }) => {
  if (!output) return null;

  const icon = output.type === "error" ? "✗" : output.type === "success" ? "✓" : "◇";
  const color = output.type === "error" ? theme.error : output.type === "success" ? theme.success : theme.primary;

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Box>
        <Text color={color} bold>{icon} </Text>
        <Text color={color}>{output.content}</Text>
      </Box>
      {output.items?.map((item, i) => (
        <Box key={i} marginLeft={2}>
          <Text dimColor>  {item}</Text>
        </Box>
      ))}
    </Box>
  );
};
