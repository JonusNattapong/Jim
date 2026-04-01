/**
 * Progress Bar Component
 * Shows a progress bar in the CLI
 */

import React from "react";
import { Box, Text } from "ink";

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  showNumbers?: boolean;
  label?: string;
  color?: string;
}

export function ProgressBar({
  current,
  total,
  width = 30,
  showPercentage = true,
  showNumbers = false,
  label,
  color = "cyan",
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);

  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={1}>
          <Text bold>{label}</Text>
        </Box>
      )}
      <Box>
        <Text color={color as any}>[{bar}]</Text>
        {showPercentage && (
          <Box marginLeft={1}>
            <Text color={color as any}>{percentage}%</Text>
          </Box>
        )}
        {showNumbers && (
          <Box marginLeft={1}>
            <Text dimColor>
              ({current}/{total})
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Spinner Component
 * Shows an animated spinner in the CLI
 */

interface SpinnerProps {
  text?: string;
  type?: "dots" | "line" | "circle" | "braille";
}

const spinnerFrames: Record<string, string[]> = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  circle: ["◐", "◓", "◑", "◒"],
  braille: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
};

export function Spinner({ text = "Loading...", type = "dots" }: SpinnerProps) {
  const [frame, setFrame] = React.useState(0);
  const frames = spinnerFrames[type] || spinnerFrames.dots;

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Box>
      <Text color="cyan">{frames[frame]}</Text>
      {text && (
        <Box marginLeft={1}>
          <Text>{text}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Loading State Component
 * Shows a loading state with spinner and optional progress
 */

interface LoadingStateProps {
  text?: string;
  progress?: {
    current: number;
    total: number;
  };
}

export function LoadingState({ text = "Loading...", progress }: LoadingStateProps) {
  return (
    <Box flexDirection="column">
      <Spinner text={text} />
      {progress && (
        <Box marginTop={1}>
          <ProgressBar
            current={progress.current}
            total={progress.total}
            showPercentage
            showNumbers
          />
        </Box>
      )}
    </Box>
  );
}