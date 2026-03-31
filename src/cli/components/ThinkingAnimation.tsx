import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import { GradientText } from "./GradientText.js";
import { tips } from "../tips.js";

const PHASES = [
  "▖▘▖▙▛▜▞▛▙▗▛▝▟▟", // 14 chars
  "▗▘▙▚▛▜▝▞▟▖▜▛▙",  // 13 chars
  "▘▙▚▛▜▝▞▟▖▗▝▞",   // 12 chars
  "▙▚▛▜▝▞▟▖▗▘▞",    // 11 chars
  "▚▛▜▝▞▟▖▗▘▙",     // 10 chars
  "▛▜▝▞▟▖▗▘▙▚▖",    // 11 chars
  "▜▝▞▟▖▗▘▙▚▛▗▘",   // 12 chars
  "▝▞▟▖▗▘▙▚▛▜▘▙▚",  // 13 chars
  "▞▟▖▗▘▙▚▛▜▝▙▚▛▞", // 14 chars
  "▟▖▗▘▙▚▛▜▝▞▚▛▜▟", // 14 chars
];

const PHRASES = [
  "SCANNING", "PROBING", "MAPPING", "PARSING", "MODELING",
  "RESOLVING", "REASONING", "SYNTHESIZING", "CODING", "REFINING"
];

interface ThinkingAnimationProps {
  tokens?: number;
  startTime?: number;
}

export const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({ tokens, startTime }) => {
  const [frame, setFrame] = useState(0);
  const [tipIdx] = useState(() => Math.floor(Math.random() * tips.length));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
      setNow(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const phase = frame % PHASES.length;
  const phraseIdx = Math.floor(frame / 12) % PHRASES.length;

  const elapsedMs = startTime ? now - startTime : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const displayTime = elapsedMin > 0
    ? `${elapsedMin}m ${elapsedSec % 60}s`
    : `${elapsedSec}s`;

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Box flexDirection="row">
        <Text color={theme.primary} bold>{PHASES[phase]} </Text>
        <Text bold>
          <GradientText animate={true} colors={[theme.primary, theme.secondary, theme.primaryBright, theme.primary]}>
            {PHRASES[phraseIdx]}
          </GradientText>
        </Text>
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
      <Box marginLeft={4}>
        <Text dimColor>└ Tip: {tips[tipIdx]}</Text>
      </Box>
    </Box>
  );
};
