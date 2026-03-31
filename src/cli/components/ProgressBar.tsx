import React from "react";
import { Box, Text } from "ink";

interface ProgressBarProps {
  label: string;
  percent: number;
  width?: number;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  label, 
  percent, 
  width = 30, 
  color = "cyan" 
}) => {
  const filledWidth = Math.floor((percent / 100) * width);
  const bar = [];
  for (let i = 0; i < width; i++) {
    if (i < filledWidth) {
      // Premium gradient effect: Cyan to Blue to Magenta
      let charColor = color;
      if (i > (width * 0.7)) charColor = "magenta";
      else if (i > (width * 0.4)) charColor = "blue";
      
      bar.push(<Text key={i} color={charColor}>█</Text>);
    } else {
      bar.push(<Text key={i} color="gray">░</Text>);
    }
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text color="yellow">⚡ </Text>
          <Text color={color} bold>{label.toUpperCase()}</Text>
        </Box>
        <Text color={color} bold>{Math.floor(percent)}%</Text>
      </Box>
      <Box>
        <Text color="gray">[</Text>
        {bar}
        <Text color="gray">]</Text>
      </Box>
    </Box>
  );
};
