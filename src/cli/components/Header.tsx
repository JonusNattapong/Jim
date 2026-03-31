import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

interface HeaderProps {
  model: string;
  mode: string;
  workMode: string;
  streaming: boolean;
  tokens: number;
  projectRoot: string;
  username?: string;
}

export const Header: React.FC<HeaderProps> = ({ model, mode, workMode, streaming, tokens, projectRoot, username }) => {
  const shortModel = model.includes("/") ? model.split("/").pop()! : model;
  const user = username || "Engineer";

  // Rough blended average cost estimation: $3 per 1M tokens
  const estCost = ((tokens / 1_000_000) * 3.00).toFixed(4);
  const tokenColor = tokens > 120000 ? theme.error : tokens > 60000 ? theme.warning : theme.primary;

  return (
    <Box flexDirection="column" marginBottom={1} width="100%">
      {/* Top Banner with Title */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          <Text color={theme.primary} bold>JimCode </Text>
          <Text color={theme.textBright}>{process.env.JIM_VERSION || "v0.4.0"}</Text>
        </Box>
        <Text color={theme.textMuted} dimColor>RockStar Coder</Text>
      </Box>

      {/* Main Dashboard Box */}
      <Box borderStyle="single" borderColor={theme.primary} flexDirection="row" paddingX={2} paddingY={0}>
        {/* Left Section: Branding & ASCII */}
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
            <Text color={theme.secondary} dimColor>{projectRoot}</Text>
          </Box>
        </Box>

        {/* Right Section: System Metadata */}
        <Box
          flexDirection="column"
          width="65%"
          paddingY={1}
          paddingLeft={3}
          marginLeft={1}
          borderStyle="single"
          borderColor={theme.primary}
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color={theme.primary} bold>Welcome {user}</Text>
            <Box>
              <Text color={theme.secondary} bold>[{projectRoot.split(/[\\\/]/).pop()}]</Text>
            </Box>
          </Box>

          <Box flexDirection="column">
            <Box justifyContent="space-between">
              <Box>
                <Text color={theme.textMuted} dimColor>● PROBE STATUS: </Text>
                <Text color={theme.primary} bold>ACTIVE</Text>
              </Box>
              <Box>
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
              <Box>
                <Box width={12}>
                  <Text color={theme.textMuted} dimColor>VERSION: </Text>
                </Box>
                <Text color={theme.textBright}>0.4.0</Text>
              </Box>
            </Box>

            <Box marginTop={1} borderStyle="single" borderColor={theme.secondary} paddingX={1} width="100%">
              <Text color={theme.textBright} italic>
                <Text color={theme.primary} bold>Tip: </Text>
                Ask Jim to explore or refactor for better results
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

