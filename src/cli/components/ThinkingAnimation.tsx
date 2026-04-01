import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";
import { tips } from "../tips.js";
import { getRandomVerb } from "../spinner-verbs.js";

interface ThinkingAnimationProps {
  tokens?: number;
  startTime?: number;
  mode?: "condensed" | "full";
  thinking?: string;
}

export const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({ 
  tokens, 
  startTime, 
  mode = "condensed",
  thinking 
}) => {
  const [frame, setFrame] = useState(0);
  const [tipIdx] = useState(() => Math.floor(Math.random() * tips.length));
  const [now, setNow] = useState(Date.now());
  const [verb, setVerb] = useState(() => getRandomVerb());
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
      setNow(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Randomized verb rotation (every ~1.5 - 2s)
    const verbTimer = setInterval(() => {
      setVerb(getRandomVerb());
    }, 1800);
    return () => clearInterval(verbTimer);
  }, []);

  const elapsedMs = startTime ? now - startTime : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const displayTime = elapsedMin > 0
    ? `${elapsedMin}m ${elapsedSec % 60}s`
    : `${elapsedSec}s`;

  // Condensed mode - compact display
  if (mode === "condensed") {
    return (
      <Box flexDirection="column" marginTop={1} marginLeft={0}>
        <Box>
          <Text color={theme.error} bold>* </Text>
          <Text color={theme.text} bold>{verb}...</Text>
          <Text dimColor> (</Text>
          <Text color={theme.text} dimColor>{displayTime}</Text>
          {tokens !== undefined && (
            <>
              <Text dimColor> • </Text>
              <Text color={theme.text} dimColor>↓ {(tokens / 1000).toFixed(1)}k tokens</Text>
            </>
          )}
          <Text dimColor>)</Text>
        </Box>
        
        <Box marginLeft={2} marginTop={0}>
          <Text color={theme.textMuted} dimColor>└ Tip: {tips[tipIdx]}</Text>
        </Box>
      </Box>
    );
  }

  // Full mode - expanded display with thinking content
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={0}>
      <Box>
        <Text color={theme.error} bold>* </Text>
        <Text color={theme.text} bold>{verb}...</Text>
        <Text dimColor> (</Text>
        <Text color={theme.text} dimColor>{displayTime}</Text>
        {tokens !== undefined && (
          <>
            <Text dimColor> • </Text>
            <Text color={theme.text} dimColor>↓ {(tokens / 1000).toFixed(1)}k tokens</Text>
          </>
        )}
        <Text dimColor>)</Text>
      </Box>
      
      {/* Thinking content */}
      {thinking && (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          <Text color={theme.textMuted} dimColor>💭 Thinking:</Text>
          <Box marginLeft={2} marginTop={0}>
            <Text color={theme.textMuted} dimColor>
              {thinking.length > 200 ? thinking.slice(0, 200) + "..." : thinking}
            </Text>
          </Box>
        </Box>
      )}
      
      <Box marginLeft={2} marginTop={1}>
        <Text color={theme.textMuted} dimColor>└ Tip: {tips[tipIdx]}</Text>
      </Box>
    </Box>
  );
};
