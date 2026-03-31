import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

const PHASES = ["┌   ┐", "[ ̄ ̯̄ ]", "[  ̄ ̯̄  ]", "[   ̄ ̯̄   ]", "[  ̄ ̯̄  ]", "[ ̄ ̯̄ ]"];

const PHRASES = [
  "Scanning...",
  "Transmitting...",
  "Processing...",
  "Analyzing JimCode...",
  "Interfacing...",
  "Decoding...",
  "Evaluating...",
  "Synchronizing...",
  "Probing...",
  "Calculating...",
  "Transmuting...",
];

const TIPS = [
  "Run /terminal-setup to enable Shift+Enter for new lines",
  "Use /stats to see your usage metrics",
  "The /compact command reduces context noise",
  "Ask /help to see all commands",
  "You can /reset to clear the conversation",
  "Try /checkpoint to save a snapshot",
  "Stay minimal, stay focused",
  "Welcome back, Engineer",
];

interface ThinkingAnimationProps {
  tokens?: number;
  startTime?: number;
}

export const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({ tokens, startTime }) => {
  const [frame, setFrame] = useState(0);
  const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
      setNow(Date.now());
    }, 250);
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
        <Text color={theme.primary} bold>{PHRASES[phraseIdx]}</Text>
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
        <Text dimColor>└ Tip: {TIPS[tipIdx]}</Text>
      </Box>
    </Box>
  );
};
