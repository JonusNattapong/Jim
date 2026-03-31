import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";
import { DiffPreview } from "./DiffPreview.js";

interface DiffPreviewData {
  filePath: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

interface PermissionPromptProps {
  toolName: string;
  args: string;
  diffPreview?: DiffPreviewData;
  onResolve: (approved: boolean) => void;
}

function toolIcon(toolName: string): string {
  switch (toolName) {
    case "edit_file": return "~";
    case "write_file": return "+";
    case "run_command": return ">";
    case "git_command": return "#";
    default: return "?";
  }
}

function toolVerb(toolName: string): string {
  switch (toolName) {
    case "edit_file": return "edit";
    case "write_file": return "write";
    case "run_command": return "run";
    case "git_command": return "execute git";
    default: return "execute";
  }
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({ toolName, args, diffPreview, onResolve }) => {
  useInput((input, key) => {
    if (input === "y" || input === "Y") {
      onResolve(true);
    } else if (input === "n" || input === "N" || key.return) {
      onResolve(false);
    }
  });

  const isFileTool = toolName === "edit_file" || toolName === "write_file";

  return (
    <Box marginLeft={2} marginTop={1} flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1}>
      {/* Header */}
      <Box>
        <Text color={theme.warning} bold>{toolIcon(toolName)} </Text>
        <Text color={theme.warning} bold>Allow {toolVerb(toolName)}?</Text>
      </Box>

      {/* Tool info */}
      <Box marginLeft={1}>
        <Text dimColor>tool </Text>
        <Text color={theme.success} bold>{toolName}</Text>
        {!isFileTool && (
          <>
            <Text dimColor>  args </Text>
            <Text>{args.slice(0, 60)}{args.length > 60 ? "..." : ""}</Text>
          </>
        )}
      </Box>

      {/* Diff preview for file tools */}
      {diffPreview && (
        <DiffPreview
          filePath={diffPreview.filePath}
          diff={diffPreview.diff}
          linesAdded={diffPreview.linesAdded}
          linesRemoved={diffPreview.linesRemoved}
          compact
        />
      )}

      {/* File path for file tools without diff */}
      {isFileTool && !diffPreview && (
        <Box marginLeft={1}>
          <Text dimColor>file </Text>
          <Text>{args.slice(0, 70)}</Text>
        </Box>
      )}

      {/* Action keys */}
      <Box marginLeft={1} marginTop={1}>
        <Text color={theme.success} bold>Y</Text>
        <Text dimColor> accept  </Text>
        <Text color={theme.error} bold>N</Text>
        <Text dimColor> reject</Text>
      </Box>
    </Box>
  );
};
