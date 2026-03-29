import React from "react";
import { Box, Text } from "ink";

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
  const tokenColor = tokens > 120000 ? "red" : tokens > 60000 ? "yellow" : "greenBright";

  return (
    <Box flexDirection="column" marginBottom={1} width="100%">
      {/* Top Banner with Title */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text color="greenBright" bold>👽 Jim {process.env.JIM_VERSION || "v0.4.0"}</Text>
        <Text dimColor>Alien v2.1</Text>
      </Box>

      {/* Main Dashboard Box */}
      <Box borderStyle="single" borderColor="greenBright" flexDirection="row" paddingX={2} paddingY={0}>
        {/* Left Section: Branding & ASCII */}
        <Box flexDirection="column" width="35%" paddingY={1} alignItems="center">
          <Box marginY={1}>
            <Text color="greenBright" bold>
      {`    👽 ALIEN ZONE 🛸
      ╭───────────────╮
      │  XENOCODE AI  │
      ╰───────────────╯
        🛸 👽 💫`}
            </Text>
          </Box>
          <Box flexDirection="column" alignItems="center">
            <Text color="greenBright" bold>{shortModel}</Text>
            <Text color="greenBright" dimColor>{projectRoot}</Text>
          </Box>
        </Box>

        {/* Vertical Accent */}
        <Box width={1} />
        <Box borderStyle="single" borderColor="greenBright" borderLeft={true} borderRight={false} borderTop={false} borderBottom={false} height={8} />
        <Box width={3} />

        {/* Right Section: System Metadata */}
        <Box flexDirection="column" width="65%" paddingY={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color="greenBright" bold>👽 ALIEN CONTROL</Text>
            <Box>
               <Text color="greenBright" bold>[{projectRoot.split(/[\\\\\\\\]/).pop()}]</Text>
            </Box>
          </Box>
          
          <Box flexDirection="column">
             <Box justifyContent="space-between">
                <Box>
                  <Text dimColor>● PROBE STATUS: </Text>
                  <Text color="greenBright" bold>👽 ACTIVE</Text>
                </Box>
                <Box>
                  <Box width={12}>
                    <Text dimColor>SCAN MODE: </Text>
                  </Box>
                  <Text color="greenBright" bold>{mode.toUpperCase()}</Text>
                </Box>
             </Box>

             <Box marginTop={1} justifyContent="space-between">
                <Box>
                  <Text dimColor>● ENVIRONMENT: </Text>
                  <Text color="greenBright" bold>{workMode.toUpperCase()}</Text>
                </Box>
                <Box>
                  <Box width={12}>
                    <Text dimColor>VERSION: </Text>
                  </Box>
                  <Text color="white">0.4.0-α</Text>
                </Box>
             </Box>

             <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} width="100%">
                <Text color="white" italic>
                  <Text color="yellow" bold>💡 Tip: </Text>
                  Ask Jim to explore or refactor for better results
                </Text>
             </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer Status Line */}
      <Box justifyContent="flex-start" paddingX={1} marginTop={0}>
        <Text dimColor>/models to change AI  •  </Text>
        <Text dimColor>Tokens: </Text>
        <Text color={tokenColor} bold>
          {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`}
        </Text>
        <Text dimColor> | Cost: </Text>
        <Text color={parseFloat(estCost) > 0.5 ? "redBright" : "blueBright"}>~${estCost}</Text>
        <Text dimColor>  •  </Text>
        <Text color={streaming ? "magenta" : "gray"} dimColor={!streaming}>
          {streaming ? "⚡stream" : "■ batch"}
        </Text>
      </Box>
    </Box>
  );
};
