import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { MarkdownText } from "./MarkdownText.js";
import { GradientText } from "./GradientText.js";

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
        <Box 
          flexDirection="column" 
          flexShrink={1} 
          borderStyle="single" 
          borderColor={theme.secondary} 
          borderLeft={true} 
          borderRight={false} 
          borderTop={false} 
          borderBottom={false} 
          paddingLeft={1}
        >
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
