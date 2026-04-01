import React from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme.js";

interface PlanApprovalPromptProps {
  onResolve: (approved: boolean) => void;
}

export const PlanApprovalPrompt: React.FC<PlanApprovalPromptProps> = ({ onResolve }) => {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === "y" || key === "a") {
      onResolve(true);
    } else if (key === "n" || key === "r") {
      onResolve(false);
    }
  });

  return (
    <Box 
      marginTop={1} 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={theme.warning} 
      paddingX={2}
      paddingY={0}
    >
      <Box>
        <Text color={theme.warning} bold>● </Text>
        <Text bold>Plan Pending Approval</Text>
      </Box>

      <Box marginLeft={2} marginTop={0}>
        <Text color={theme.textMuted}>Review the tasks above. Do you want to proceed with this plan?</Text>
      </Box>

      <Box marginLeft={2} marginTop={1} gap={2}>
        <Box>
          <Text color={theme.success} bold>y</Text>
          <Text color={theme.textMuted}> approve</Text>
        </Box>
        <Box>
          <Text color={theme.error} bold>n</Text>
          <Text color={theme.textMuted}> reject</Text>
        </Box>
      </Box>
    </Box>
  );
};
