import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

interface StatusBarProps {
  turn: number;
  messageCount: number;
  sessionId: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ turn, messageCount, sessionId }) => {
  const shortSession = sessionId.slice(0, 8);
  return (
    <Box marginTop={1} marginBottom={0}>
      <Text dimColor>{'─'.repeat(50)}</Text>
    </Box>
  );
};

export const StatusInfo: React.FC<StatusBarProps> = ({ turn, messageCount, sessionId }) => {
  const shortSession = sessionId.slice(0, 8);
  return (
    <Box>
      <Text dimColor>  ● turn </Text>
      <Text color={theme.primary} dimColor>{turn}</Text>
      <Text dimColor>  •  {messageCount} messages</Text>
      <Text dimColor>  •  </Text>
      <Text color={theme.secondary} dimColor>{shortSession}</Text>
    </Box>
  );
};
