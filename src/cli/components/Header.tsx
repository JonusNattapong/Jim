import React, { useState } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { getRandomTip } from "../tips.js";
import { getRandomTagline } from "../taglines.js";

interface HeaderProps {
  model: string;
  mode: string;
  workMode: string;
  streaming: boolean;
  tokens: number;
  projectRoot: string;
  username?: string;
  yolo?: boolean;
}

const HeaderComponent: React.FC<HeaderProps & { columns?: number }> = ({ model, mode, workMode, projectRoot, username, yolo, columns = 100 }) => {
  const shortModel = model.includes("/") ? model.split("/").pop()! : model;
  const user = username || "Admin";
  const [tip] = useState(getRandomTip());
  const [tagline] = useState(getRandomTagline());

  const displayPath = projectRoot;

  return (
    <Box flexDirection="column" marginBottom={1} width="100%">
      {/* ─── Level 1: Global Session Bar (All-Left Align) ────────────────────────── */}
      <Box justifyContent="flex-start" paddingX={2} marginBottom={0}>
        <Box gap={1} alignItems="center">
          <Box>
            <Text color={theme.textMuted} dimColor>SESSION: </Text>
            <Text color={theme.primary} bold>{user}</Text>
          </Box>
          <Text color={theme.textMuted} dimColor> • </Text>
          <Box backgroundColor={theme.primary} paddingX={1}>
             <Text color={theme.inverse} bold>ACTIVE</Text>
          </Box>
          <Text color={theme.textMuted} dimColor> • </Text>
          <Box>
            <Text color={theme.textMuted} dimColor>{displayPath}</Text>
          </Box>
        </Box>
      </Box>

      {/* ─── Level 2: Modern Branding (Left Aligned) ─────────────────────────────── */}
      <Box paddingX={2} marginY={0}>
        <Text color={theme.primary} bold>
          {`
 ██╗██╗███╗   ███╗ ██████╗ ██████╗ ██████╗ ███████╗
 ╚═╝╚═╝████╗ ████║██╔════╝██╔═══██╗██╔══██╗██╔════╝
 ██╗██╗██╔████╔██║██║     ██║   ██║██║  ██║█████╗  
 ██║██║██║╚██╔╝██║██║     ██║   ██║██║  ██║██╔══╝  
 ██║██║██║ ╚═╝ ██║╚██████╗╚██████╔╝██████╔╝███████╗
 ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝`}
        </Text>
      </Box>

      {/* ─── Level 3: Minimalist Metadata (All-Left Align) ──────────────────────── */}
      <Box paddingX={4} flexDirection="column" marginTop={1}>
        {/* Tip & Tagline Block */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.textBright} italic>
            <Text color={theme.primary} bold>Tip: </Text>
            {tip}
          </Text>
          <Box marginTop={0}>
            <Text color={theme.textMuted} dimColor italic>"{tagline}"</Text>
          </Box>
        </Box>

        {/* System Settings */}
        <Box justifyContent="flex-start" gap={4}>
          <Box>
            <Text color={theme.textMuted} dimColor>MODEL: </Text>
            <Text color={theme.primary} bold>{shortModel}</Text>
          </Box>
          <Box>
            <Text color={theme.textMuted} dimColor>MODE: </Text>
            <Text color={theme.secondary} bold>{mode.toUpperCase()}</Text>
          </Box>
          <Box>
            <Text color={theme.textMuted} dimColor>ENV: </Text>
            <Text color={theme.secondary} bold>{workMode.toUpperCase()}</Text>
          </Box>
          {yolo && (
            <Box>
              <Text backgroundColor={theme.error} color={theme.inverse} bold> [ YOLO MODE ACTIVE ] </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Level 4: Bottom Separator Line ───────────────────────────────────────── */}
      <Box paddingX={2} marginTop={1}>
        <Text color={theme.border} dimColor>{"─".repeat(columns - 4)}</Text>
      </Box>
    </Box>
  );
};

export const Header = React.memo(HeaderComponent);
