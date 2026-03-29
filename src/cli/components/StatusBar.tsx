import React from "react";
import { Box, Text } from "ink";

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
      <Text dimColor>  � probe </Text>
      <Text color="greenBright" dimColor>{turn}</Text>
      <Text dimColor>  •  {messageCount} signals</Text>
      <Text dimColor>  •  </Text>
      <Text color="greenBright" dimColor>{shortSession}</Text>
    </Box>
  );
};
