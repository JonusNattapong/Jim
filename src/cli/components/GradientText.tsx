import React, { useState, useEffect } from "react";
import { Text } from "ink";

interface GradientTextProps {
  children: string;
  colors: string[]; // List of HEX colors to interpolate through
  animate?: boolean;
}

/**
 * Interpolates between two HEX colors.
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex = (x: string) => parseInt(x.replace("#", ""), 16);
  const r1 = (hex(color1) >> 16) & 0xff;
  const g1 = (hex(color1) >> 8) & 0xff;
  const b1 = hex(color1) & 0xff;

  const r2 = (hex(color2) >> 16) & 0xff;
  const g2 = (hex(color2) >> 8) & 0xff;
  const b2 = hex(color2) & 0xff;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Renders text with a character-by-character color gradient.
 * If animate is true, the gradient shifts over time.
 */
export const GradientText: React.FC<GradientTextProps> = ({ children, colors, animate }) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setOffset((prev) => (prev + 0.05) % 1.0);
    }, 300);
    return () => clearInterval(timer);
  }, [animate]);

  if (colors.length < 2) return <Text>{children}</Text>;

  const chars = children.split("");
  return (
    <>
      {chars.map((char, i) => {
        // Calculate raw progress (0..1)
        const rawProgress = i / (chars.length - 1 || 1);
        
        // Add offset for animation (wrapped to 0..1)
        const progress = (rawProgress + offset) % 1.0;
        
        const segmentCount = colors.length - 1;
        const segmentProgress = progress * segmentCount;
        const segmentIndex = Math.min(Math.floor(segmentProgress), segmentCount - 1);
        const localFactor = segmentProgress - segmentIndex;

        const color = interpolateColor(
          colors[segmentIndex],
          colors[segmentIndex + 1],
          localFactor
        );

        return (
          <Text key={i} color={color}>
            {char}
          </Text>
        );
      })}
    </>
  );
};
