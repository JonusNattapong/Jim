import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { getRandomTip } from "../tips.js";
import { GradientText } from "./GradientText.js";

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

const HeaderComponent: React.FC<HeaderProps & { columns?: number }> = ({ model, mode, workMode, streaming, tokens, projectRoot, username, yolo, columns = 100 }) => {
  const shortModel = model.includes("/") ? model.split("/").pop()! : model;
  const user = username || "Engineer";
  const [tip] = useState(getRandomTip());

  const showAscii = columns >= 90;
  const maxPathLen = Math.floor(columns * 0.4);
  const displayPath = projectRoot.length > maxPathLen ? "..." + projectRoot.slice(-maxPathLen) : projectRoot;

  // Rough blended average cost estimation: $3 per 1M tokens
  const estCost = ((tokens / 1_000_000) * 3.00).toFixed(4);
  const tokenColor = tokens > 120000 ? theme.error : tokens > 60000 ? theme.warning : theme.primary;

  return (
    <Box flexDirection="column" marginBottom={1} width="100%">
      {/* Top Banner with Title */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          <Text color={theme.primary} bold>JIMCODE </Text>
        </Box>
        <Text color={theme.textMuted} dimColor>{process.env.JIM_VERSION || "v1.0.0"}</Text>
      </Box>

      {/* Main Dashboard Box */}
      <Box borderStyle="single" borderColor={theme.primary} flexDirection="row" paddingX={2} paddingY={0}>
        {/* Left Section: Branding & ASCII */}
        {showAscii && (
          <Box flexDirection="column" width="35%" paddingY={1} alignItems="center">
            <Box marginY={1}>
              <Text color={theme.primary} bold>
                {`
     .::                
     .:: .:             
     .::   .::: .:: .:: 
     .::.:: .::  .:  .::
     .::.:: .::  .:  .::
.:   .::.:: .::  .:  .::
 .::::  .::.:::  .:  .::
                        
       `}
              </Text>
            </Box>
            <Box flexDirection="column" alignItems="center">
              <Text color={theme.primary} bold>{shortModel}</Text>
              <Text color={theme.secondary} dimColor>{displayPath.slice(0, 30)}</Text>
            </Box>
          </Box>
        )}

        {/* Right Section: System Metadata */}
        <Box
          flexDirection="column"
          width={showAscii ? "65%" : "100%"}
          paddingY={1}
          paddingLeft={showAscii ? 3 : 0}
          marginLeft={showAscii ? 1 : 0}
          borderStyle="single"
          borderColor={theme.primary}
          borderLeft={showAscii}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color={theme.primary} bold>Welcome {user}</Text>
            <Box>
              <Text color={theme.secondary} bold>[{displayPath.split(/[\\\/]/).pop()}]</Text>
            </Box>
          </Box>

          <Box flexDirection="column">
            <Box justifyContent="space-between">
              <Box>
                <Text color={theme.textMuted} dimColor>● PROBE STATUS: </Text>
                <Text color={theme.primary} bold>ACTIVE</Text>
              </Box>
              <Box>
                {yolo && (
                  <Box marginRight={2}>
                    <Text color={theme.error} bold>[ YOLO ]</Text>
                  </Box>
                )}
                <Box width={12}>
                  <Text color={theme.textMuted} dimColor>SCAN MODE: </Text>
                </Box>
                <Text color={theme.primary} bold>{mode.toUpperCase()}</Text>
              </Box>
            </Box>

            <Box marginTop={1} justifyContent="space-between">
              <Box>
                <Text color={theme.textMuted} dimColor>● ENVIRONMENT: </Text>
                <Text color={theme.primary} bold>{workMode.toUpperCase()}</Text>
              </Box>
              {!showAscii && (
                <Box>
                   <Text color={theme.secondary} bold>{shortModel}</Text>
                </Box>
              )}
            </Box>

            {/* Tip Box */}
            <Box marginTop={1} borderStyle="single" borderColor={theme.secondary} paddingX={1} width="100%">
              <Text color={theme.textBright} italic>
                <Text color={theme.primary} bold>Tip: </Text>
                {tip}
              </Text>
            </Box>

          </Box>
        </Box>
      </Box>

      {/* Footer Status Line */}
      <Box justifyContent="flex-start" paddingX={1} marginTop={0}>
        <Text color={theme.textMuted} dimColor>/models to change AI  •  </Text>
        <Text color={theme.textMuted} dimColor>Tokens: </Text>
        <Text color={tokenColor} bold>
          {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`}
        </Text>
        <Text color={theme.textMuted} dimColor> | Cost: </Text>
        <Text color={parseFloat(estCost) > 0.5 ? theme.error : theme.secondary}>~${estCost}</Text>
        <Text color={theme.textMuted} dimColor>  •  </Text>
        <Text color={streaming ? theme.success : theme.textMuted} dimColor={!streaming}>
          {streaming ? "stream" : "batch"}
        </Text>
      </Box>
    </Box>
  );
};

export const Header = React.memo(HeaderComponent);

