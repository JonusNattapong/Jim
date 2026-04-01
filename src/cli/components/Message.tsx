import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";
import { MarkdownText } from "./MarkdownText.js";
import { TaskBoard, parseTaskBoard } from "./TaskBoard.js";

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

interface MessageProps {
  role: "user" | "assistant" | "system" | "attachment" | "grouped_tool_use";
  content: string;
  attachment?: {
    type: string;
    name: string;
    size?: number;
  };
  toolGroup?: {
    tools: Array<{
      name: string;
      status: "running" | "done" | "error";
      result?: string;
    }>;
  };
}

const MessageComponent: React.FC<MessageProps> = ({ role, content, attachment, toolGroup }) => {
  const { theme } = useTheme();
  
  // Handle attachment type
  if (role === "attachment" && attachment) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Box flexDirection="row">
          <Text color={theme.info} bold>📎 </Text>
          <Text color={theme.text} bold>{attachment.name}</Text>
          <Text color={theme.textMuted}> ({attachment.type})</Text>
          {attachment.size && (
            <Text color={theme.textMuted}> • {formatFileSize(attachment.size)}</Text>
          )}
        </Box>
      </Box>
    );
  }
  
  // Handle grouped tool use
  if (role === "grouped_tool_use" && toolGroup) {
    const successCount = toolGroup.tools.filter(t => t.status === "done").length;
    const errorCount = toolGroup.tools.filter(t => t.status === "error").length;
    const runningCount = toolGroup.tools.filter(t => t.status === "running").length;
    
    return (
      <Box marginTop={1} flexDirection="column">
        <Box flexDirection="row">
          <Text color={theme.primary} bold>⊞ </Text>
          <Text color={theme.primary}>Executed {toolGroup.tools.length} tools </Text>
          <Text color={theme.success}>{successCount > 0 ? `✓ ${successCount} ` : ""}</Text>
          <Text color={theme.error}>{errorCount > 0 ? `✗ ${errorCount} ` : ""}</Text>
          {runningCount > 0 && <Text color={theme.warning} italic> [running...]</Text>}
        </Box>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {toolGroup.tools.map((tool, i) => (
            <Box key={i} flexDirection="row">
              <Text dimColor>  </Text>
              {tool.status === "running" ? (
                <Text color={theme.warning}>●</Text>
              ) : tool.status === "done" ? (
                <Text color={theme.success}>✓</Text>
              ) : (
                <Text color={theme.error}>✗</Text>
              )}
              <Text> </Text>
              <Text color={tool.status === "error" ? theme.error : theme.text} bold>{tool.name}</Text>
              {tool.result && (
                <Text dimColor> {tool.result.slice(0, 50)}{tool.result.length > 50 ? "..." : ""}</Text>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }
  
  if (role === "user") {
    return (
      <Box marginTop={1} flexDirection="row">
        <Text color={theme.primary} bold>You: </Text>
        <Text bold color={theme.text}>{content}</Text>
      </Box>
    );
  }

  if (role === "assistant") {
    const taskBoardData = parseTaskBoard(content);

    return (
      <Box marginTop={1} flexDirection="column">
        <Box flexDirection="row">
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

        {/* Surprise: Render a structured Task Board if found! */}
        {taskBoardData && (
          <Box marginTop={0} marginBottom={1}>
            <TaskBoard board={taskBoardData} />
          </Box>
        )}
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

export const Message = React.memo(MessageComponent);
