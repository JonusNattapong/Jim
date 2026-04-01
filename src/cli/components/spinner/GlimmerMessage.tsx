/**
 * GlimmerMessage Component
 * Shimmer animation for messages with word-level highlighting
 * Inspired by Claude Code's Spinner components
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme.js";
import { FlashingChar } from "./FlashingChar.js";

interface GlimmerMessageProps {
  message: string;
  messageColor: string;
  glimmerIndex: number;
  flashOpacity: number;
  shimmerColor: string;
  stalledIntensity?: number;
}

export const GlimmerMessage: React.FC<GlimmerMessageProps> = ({
  message,
  messageColor,
  glimmerIndex,
  flashOpacity,
  shimmerColor,
  stalledIntensity = 0,
}) => {
  const { theme } = useTheme();
  
  // Split message into segments for word-level highlighting
  const segments = useMemo(() => {
    const result: { text: string; isHighlighted: boolean }[] = [];
    let currentIndex = 0;
    
    // Simple word-based segmentation
    const words = message.split(/(\s+)/);
    
    for (const word of words) {
      const isHighlighted = 
        currentIndex >= glimmerIndex - 1 && 
        currentIndex <= glimmerIndex + 1;
      
      result.push({
        text: word,
        isHighlighted,
      });
      
      currentIndex += word.length;
    }
    
    return result;
  }, [message, glimmerIndex]);
  
  // Handle stalled state (change to red when tokens stop flowing)
  if (stalledIntensity > 0) {
    const color = stalledIntensity > 0.5 ? theme.error : messageColor;
    return (
      <Box flexDirection="row">
        <Text color={color}>{message}</Text>
        <Text color={color}> </Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="row">
      {segments.map((segment, index) => {
        if (segment.isHighlighted) {
          return (
            <FlashingChar
              key={index}
              char={segment.text}
              flashOpacity={flashOpacity}
              messageColor={messageColor}
              shimmerColor={shimmerColor}
            />
          );
        }
        
        return (
          <Text key={index} color={messageColor}>
            {segment.text}
          </Text>
        );
      })}
      <Text color={messageColor}> </Text>
    </Box>
  );
};