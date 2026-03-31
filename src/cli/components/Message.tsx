import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { MarkdownText } from "./MarkdownText.js";

interface MessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export const Message: React.FC<MessageProps> = ({ role, content }) => {
  if (role === "user") {
    return (
      <Box marginTop={1} flexDirection="row">
        <Text color={theme.primary} bold>You: </Text>
        <Text bold color={theme.text}>{content}</Text>
      </Box>
    );
  }

  if (role === "assistant") {
    return (
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" marginRight={1}>
          <Text color={theme.secondary}>▌</Text>
          {content.split("\n").slice(1).map((_, i) => (
            <Text key={i} color={theme.secondary}>▌</Text>
          ))}
        </Box>
        <Box flexDirection="column" flexShrink={1}>
          <MarkdownText>{content}</MarkdownText>
        </Box>
      </Box>
    );
  }

  // system
  return (
    <Box marginTop={0} marginLeft={2}>
      <Text dimColor italic>⟡ {content}</Text>
    </Box>
  );
};
