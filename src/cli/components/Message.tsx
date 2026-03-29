import React from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./MarkdownText.js";

interface MessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export const Message: React.FC<MessageProps> = ({ role, content }) => {
  if (role === "user") {
    return (
      <Box marginTop={1} flexDirection="row">
        <Text color="yellow" bold>❯ </Text>
        <Text bold color="white">{content}</Text>
      </Box>
    );
  }

  if (role === "assistant") {
    return (
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" marginRight={1}>
          <Text color="green">▌</Text>
          {content.split("\n").slice(1).map((_, i) => (
            <Text key={i} color="green">▌</Text>
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
