import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";

type Pattern =
  | "Checkerboard"
  | "Classic"
  | "Diamond"
  | "Interference"
  | "Kaleidoscope"
  | "Matrix"
  | "Metaballs"
  | "Moiré"
  | "Pulse"
  | "Ripple"
  | "Spiral"
  | "Tunnel"
  | "Vortex"
  | "Warp"
  | "Waves"
  | "Ocean"
  | "PlasmaMatrix";

interface RetroShaderProps {
  width: number;
  height: number;
  pattern?: Pattern;
}

const CHAR_GRADIENT = " .:-=+*#%@";

export const RetroShader: React.FC<RetroShaderProps> = ({ width, height, pattern = "Vortex" }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((t) => t + 0.03);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const renderFrame = () => {
    const lines = [];
    const aspect = width / (height * 2);

    for (let y = 0; y < height; y++) {
      let line = "";
      for (let x = 0; x < width; x++) {
        const nx = (x / width) * 2 - 1;
        const ny = (y / height) * 2 - 1;
        const px = nx * aspect;
        const py = ny;

        let v = 0;

        switch (pattern) {
          case "PlasmaMatrix":
            const p1 = Math.sin(px * 4.0 + time) + Math.cos(py * 3.0 + time * 0.5);
            const m1 = Math.sin(px * 25.0) * Math.sin(py * 2.0 + time * 15.0 + Math.sin(px * 123.4) * 20.0);
            v = ((p1 + 2.0) / 4.0) * (m1 > 0.6 ? 1.0 : 0.2); 
            v = Math.min(Math.max(v, 0), 1);
            break;
          case "Ocean":
            const w1 = Math.sin(px * 1.5 + time * 1.2) * 0.5;
            const w2 = Math.sin(px * 3.5 - time * 0.8) * 0.3;
            const w3 = Math.sin(px * 6.5 + time * 2.0) * 0.2;
            const waveHeight = (w1 + w2 + w3) * 0.5;
            // Intersection with the scanline
            const distToWave = py - waveHeight;
            v = 1.0 - Math.abs(distToWave) * 2.0; 
            v = Math.max(0, Math.min(1, v + (1.0 - py) * 0.3)); // Add some depth glow
            break;
          case "Waves":
            v = Math.sin(py * 15 + time * 5 + Math.sin(px * 10 + time));
            v = (v + 1) / 2;
            break;
          case "Checkerboard":
            v = Math.abs((Math.floor(px * 10 + Math.sin(time)) + Math.floor(py * 10 + Math.cos(time))) % 2);
            break;
          case "Classic": // Plasma
            v = Math.sin(px * 10 + time) + Math.sin((px * Math.cos(time * 0.5) + py * Math.sin(time * 0.5)) * 10) + Math.sin(Math.sqrt(px * px + py * py) * 10 + time);
            v = (v + 3) / 6;
            break;
          case "Diamond":
            v = Math.sin((Math.abs(px) + Math.abs(py)) * 10 - time * 5);
            v = (v + 1) / 2;
            break;
          case "Interference":
            const d1 = Math.sqrt((px - 0.5) ** 2 + py ** 2);
            const d2 = Math.sqrt((px + 0.5) ** 2 + py ** 2);
            v = Math.sin(d1 * 20 - time * 5) + Math.sin(d2 * 20 - time * 5);
            v = (v + 2) / 4;
            break;
          case "Kaleidoscope":
            const ang = Math.abs((Math.atan2(py, px) || 0) % (Math.PI / 3));
            const r = Math.sqrt(px * px + py * py);
            v = Math.sin(r * 15 + ang * 5 - time * 5);
            v = (v + 1) / 2;
            break;
          case "Matrix":
            v = Math.sin(px * 20) * Math.sin(py * 5 + time * 20 + Math.sin(px * 50) * 10);
            v = v > 0.7 ? 1 : 0;
            break;
          case "Metaballs":
            const b1 = 1 / (Math.sqrt((px - Math.cos(time)) ** 2 + (py - Math.sin(time)) ** 2) + 0.5);
            const b2 = 1 / (Math.sqrt((px + Math.cos(time * 0.7)) ** 2 + (py + Math.sin(time * 0.8)) ** 2) + 0.5);
            v = (b1 + b2) / 4;
            break;
          case "Moiré":
            v = Math.sin(Math.sqrt(px * px + py * py) * 30) + Math.sin(Math.sqrt((px - 0.2) ** 2 + py ** 2) * 30 + time);
            v = (v + 2) / 4;
            break;
          case "Pulse":
            const dist = Math.sqrt(px * px + py * py);
            v = Math.sin(dist * 10 - time * 5) * (1 - dist);
            v = (v + 1) / 2;
            break;
          case "Ripple":
            v = Math.sin(Math.sqrt(px * px + py * py) * 30 - time * 10);
            v = (v + 1) / 2;
            break;
          case "Spiral":
            v = Math.sin(Math.sqrt(px * px + py * py) * 20 + Math.atan2(py, px) * 5 - time * 10);
            v = (v + 1) / 2;
            break;
          case "Tunnel":
            v = Math.sin(1 / (Math.sqrt(px * px + py * py) + 0.01) + time * 10);
            v = (v + 1) / 2;
            break;
          case "Vortex":
            v = Math.sin(Math.atan2(py, px) * 10 + Math.sqrt(px * px + py * py) * 10 - time * 10);
            v = (v + 1) / 2;
            break;
          case "Warp":
            v = Math.sin(Math.atan2(py, px) * 50) * (1 / (Math.sqrt(px * px + py * py) + 0.1)) * (Math.sin(time) * 0.5 + 0.5);
            v = Math.min(Math.max(v, 0), 1);
            break;
          default:
            v = 0;
        }

        const charIdx = Math.floor(v * (CHAR_GRADIENT.length - 1));
        line += CHAR_GRADIENT[Math.max(0, Math.min(CHAR_GRADIENT.length - 1, charIdx))];
      }
      lines.push(line);
    }
    return lines.join("\n");
  };

  return (
    <Box>
      <Text color={theme.primary}>{renderFrame()}</Text>
    </Box>
  );
};
