import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { useTaskStatusSnapshot } from "../stores/taskStatusStore.js";

interface StatusBarProps {
  turn: number;
  messageCount: number;
  sessionId: string;
  model?: string;
  projectRoot?: string;
  tokens?: number;
  cost?: string;
  streaming?: boolean;
  showHeader?: boolean;
  columns?: number;
}

const StatusBarComponent: React.FC<StatusBarProps> = ({ turn, messageCount, sessionId }) => {
  const snapshot = useTaskStatusSnapshot();
  return (
    <Box marginTop={1} marginBottom={0}>
      <Text dimColor>{'─'.repeat(50)}</Text>
      {snapshot.latestBoard ? (
        <Text dimColor>{`  tasks ${snapshot.latestBoard.completed}/${snapshot.latestBoard.total}`}</Text>
      ) : null}
    </Box>
  );
};

const StatusInfoComponent: React.FC<StatusBarProps> = ({ turn, messageCount, sessionId, model, projectRoot, tokens, cost, streaming, showHeader }) => {
  const shortSession = sessionId.slice(0, 8);
  const snapshot = useTaskStatusSnapshot();
  const shortModel = model?.includes("/") ? model.split("/").pop()! : model;

  return (
    <Box flexDirection="column">
      {!showHeader && (
        <Box marginBottom={0} marginLeft={2}>
          <Text color={theme.primary} bold>{shortModel} </Text>
          <Text color={theme.textMuted} dimColor>• {projectRoot} • </Text>
          <Text color={theme.secondary}>
            {tokens && tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tokens
          </Text>
          <Text color={theme.textMuted} dimColor> (~${cost}) </Text>
          <Text color={streaming ? theme.success : theme.textMuted} dimColor={!streaming}>
            • {streaming ? "stream" : "batch"}
          </Text>
        </Box>
      )}
      <Box>
        <Text dimColor>  ● turn </Text>
        <Text color={theme.primary} dimColor>{turn}</Text>
        <Text dimColor>  •  {messageCount} messages</Text>
        {snapshot.runningCount > 0 ? <Text dimColor>{`  •  ${snapshot.runningCount} running`}</Text> : null}
        {snapshot.pendingApprovalCount > 0 ? <Text color={theme.warning}>{`  •  ${snapshot.pendingApprovalCount} approval`}</Text> : null}
        {snapshot.awaitingChoiceCount > 0 ? <Text color={theme.primary}>{`  •  ${snapshot.awaitingChoiceCount} choice`}</Text> : null}
        {snapshot.latestBoard ? <Text dimColor>{`  •  ${snapshot.latestBoard.completed}/${snapshot.latestBoard.total} tasks`}</Text> : null}
        <Text dimColor>  •  </Text>
        <Text color={theme.secondary} dimColor>{shortSession}</Text>
      </Box>
    </Box>
  );
};

export const StatusBar = React.memo(StatusBarComponent);
export const StatusInfo = React.memo(StatusInfoComponent);
