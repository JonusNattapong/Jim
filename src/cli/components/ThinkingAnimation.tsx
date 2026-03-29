import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const PHASES = ["┌   ┐", "[ ̄ ̯̄ ]", "[  ̄ ̯̄  ]", "[   ̄ ̯̄   ]", "[  ̄ ̯̄  ]", "[ ̄ ̯̄ ]"];

const PHRASES = [
  "👽 Scanning...",
  "👽 Transmitting...",
  "🛸 Cosmic processing...",
  "👽 Analyzing xenocode...",
  "Interfacing with mainframe...",
  "Decoding alien logic...",
  "Processing intergalactic data...",
  "Synchronizing quantum circuits...",
  "Probing the void...",
  "Calculating warp coordinates...",
  "Transmuting silicon...",
];

const TIPS = [
  "� Run /terminal-setup to enable Shift+Enter for new lines",
  "🛸 Use /stats to see your intergalactic metrics",
  "💫 The /compact command reduces signal degradation",
  "👽 Ask /help to access the alien database",
  "💫 You can /reset to clear corrupted data",
  "👽 Try /checkpoint to establish a teleportation point",
  "👽 Resistance is futile, but efficiency is optional",
  "🛸 Greetings, carbon-based life form",
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
    }, 250); // Single, stable pulse for all animations
    return () => clearInterval(timer);
  }, []);

  const phase = frame % PHASES.length;
  // Change phrase every ~12 frames (3 seconds at 250ms)
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
        <Text color="greenBright" bold>{PHASES[phase]} </Text>
        <Text color="greenBright" bold>{PHRASES[phraseIdx]}</Text>
        <Text dimColor> (</Text>
        <Text color="white" dimColor>{displayTime}</Text>
        {tokens !== undefined && (
          <>
            <Text dimColor> • </Text>
            <Text color="white" dimColor>↓ {(tokens / 1000).toFixed(1)}k tokens</Text>
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
