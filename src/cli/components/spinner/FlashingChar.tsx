/**
 * FlashingChar Component
 * Character with flashing animation between base color and shimmer color
 * Inspired by Claude Code's Spinner components
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useTheme, useThemeValue } from "../../theme.js";

interface FlashingCharProps {
  char: string;
  flashOpacity: number;
  messageColor: string;
  shimmerColor: string;
}

export const FlashingChar: React.FC<FlashingCharProps> = ({
  char,
  flashOpacity,
  messageColor,
  shimmerColor,
}) => {
  const { theme } = useTheme();
  
  // Interpolate between colors based on flash opacity
  const interpolateColor = (color1: string, color2: string, t: number): string => {
    // Simple color interpolation (can be enhanced with proper color parsing)
    if (t < 0.5) {
      return color1;
    }
    return color2;
  };
  
  const shouldUseShimmer = flashOpacity > 0.5;
  const color = shouldUseShimmer ? shimmerColor : messageColor;
  
  return (
    <Text color={color}>{char}</Text>
  );
};