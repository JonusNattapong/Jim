/**
 * useTokenCounter Hook
 * Smooth token counter animation
 * Inspired by Claude Code's token counter
 */

import { useRef, useState, useEffect } from "react";

interface UseTokenCounterOptions {
  currentResponseLength: number;
  reducedMotion?: boolean;
  incrementThresholds?: {
    small: number; // < 70 tokens
    medium: number; // < 200 tokens
    large: number; // >= 200 tokens
  };
}

interface UseTokenCounterResult {
  displayedResponseLength: number;
  leaderTokens: number;
}

export const useTokenCounter = ({
  currentResponseLength,
  reducedMotion = false,
  incrementThresholds = {
    small: 3,
    medium: 8,
    large: 50,
  },
}: UseTokenCounterOptions): UseTokenCounterResult => {
  const tokenCounterRef = useRef(currentResponseLength);
  const [displayedResponseLength, setDisplayedResponseLength] = useState(currentResponseLength);

  useEffect(() => {
    if (reducedMotion) {
      tokenCounterRef.current = currentResponseLength;
      setDisplayedResponseLength(currentResponseLength);
      return;
    }

    const gap = currentResponseLength - tokenCounterRef.current;
    if (gap > 0) {
      let increment: number;
      
      if (gap < 70) {
        increment = incrementThresholds.small;
      } else if (gap < 200) {
        increment = Math.max(incrementThresholds.medium, Math.ceil(gap * 0.15));
      } else {
        increment = incrementThresholds.large;
      }
      
      tokenCounterRef.current = Math.min(
        tokenCounterRef.current + increment,
        currentResponseLength
      );
      
      setDisplayedResponseLength(tokenCounterRef.current);
    }
  }, [currentResponseLength, reducedMotion, incrementThresholds]);

  const leaderTokens = Math.round(displayedResponseLength / 4);

  return {
    displayedResponseLength,
    leaderTokens,
  };
};