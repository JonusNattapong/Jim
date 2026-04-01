/**
 * useStalledAnimation Hook
 * Handles the transition to red when tokens stop flowing
 * Inspired by Claude Code's Spinner components
 */

import { useRef, useState, useEffect } from "react";

interface UseStalledAnimationOptions {
  currentResponseLength: number;
  hasActiveTools?: boolean;
  reducedMotion?: boolean;
  stallThreshold?: number; // ms before showing stalled state
  fadeDuration?: number; // ms for fade animation
}

interface UseStalledAnimationResult {
  isStalled: boolean;
  stalledIntensity: number; // 0-1, where 1 is fully stalled
}

export const useStalledAnimation = ({
  currentResponseLength,
  hasActiveTools = false,
  reducedMotion = false,
  stallThreshold = 3000, // 3 seconds
  fadeDuration = 2000, // 2 seconds
}: UseStalledAnimationOptions): UseStalledAnimationResult => {
  const lastTokenTime = useRef(Date.now());
  const lastResponseLength = useRef(currentResponseLength);
  const mountTime = useRef(Date.now());
  const stalledIntensityRef = useRef(0);
  const lastSmoothTime = useRef(Date.now());

  const [isStalled, setIsStalled] = useState(false);
  const [stalledIntensity, setStalledIntensity] = useState(0);

  // Reset timer when new tokens arrive
  if (currentResponseLength > lastResponseLength.current) {
    lastTokenTime.current = Date.now();
    lastResponseLength.current = currentResponseLength;
    stalledIntensityRef.current = 0;
    lastSmoothTime.current = Date.now();
  }

  // Calculate time since last token
  const now = Date.now();
  let timeSinceLastToken: number;

  if (hasActiveTools) {
    timeSinceLastToken = 0;
    lastTokenTime.current = now;
  } else if (currentResponseLength > 0) {
    timeSinceLastToken = now - lastTokenTime.current;
  } else {
    timeSinceLastToken = now - mountTime.current;
  }

  // Calculate stalled intensity based on time since last token
  const newIsStalled = timeSinceLastToken > stallThreshold && !hasActiveTools;
  const newIntensity = newIsStalled
    ? Math.min((timeSinceLastToken - stallThreshold) / fadeDuration, 1)
    : 0;

  // Smooth intensity transition driven by animation frame ticks
  useEffect(() => {
    if (reducedMotion) {
      setStalledIntensity(newIntensity);
      setIsStalled(newIsStalled);
      return;
    }

    const animate = () => {
      const dt = now - lastSmoothTime.current;
      if (dt >= 50) {
        const steps = Math.floor(dt / 50);
        let current = stalledIntensityRef.current;
        for (let i = 0; i < steps; i++) {
          const diff = newIntensity - current;
          if (Math.abs(diff) < 0.01) {
            current = newIntensity;
            break;
          }
          current += diff * 0.1;
        }
        stalledIntensityRef.current = current;
        lastSmoothTime.current = now;
        setStalledIntensity(current);
        setIsStalled(newIsStalled);
      }
    };

    animate();
  }, [newIntensity, newIsStalled, reducedMotion, now]);

  // When reducedMotion is enabled, use instant intensity change
  const effectiveIntensity = reducedMotion
    ? newIntensity
    : stalledIntensity;

  return {
    isStalled: newIsStalled,
    stalledIntensity: effectiveIntensity,
  };
};