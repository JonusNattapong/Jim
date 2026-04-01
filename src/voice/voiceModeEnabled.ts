/**
 * Feature Gating and Readiness Check for Voice Mode
 * Pattern: Adapted from Claude Code's voiceModeEnabled.ts
 * 
 * Pattern uses 3 levels of verification:
 * 1. Feature Flag (Feature Gate) - Kill-switch and rollout
 * 2. Authentication (Auth Check) - API keys and credentials
 * 3. Runtime Support (Platform Check) - Native OS support
 */

import { feature } from "../agent/feature-gates.js";

/**
 * Kill-switch check for voice mode. 
 * Checks the feature gate (which includes rollout percentage).
 * Default 'false' means a missing feature read as "disabled".
 * 
 * Pattern: Inspired by Claude Code's GrowthBook checks
 * Uses the global feature() helper in Jim.
 */
export function isVoiceFeatureEnabled(): boolean {
  return feature("voice_input");
}

/**
 * Auth-only check for voice mode. 
 * Returns true when the user has necessary API keys configured.
 * This prevents UI from rendering when it would fail on tool execution.
 * 
 * Pattern: Check availability for both cloud (OpenAI/ElevenLabs) 
 * and local providers.
 */
export function hasVoiceAuth(): boolean {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY);
  
  // Local/Native OS support varies by platform
  const isWindows = process.platform === 'win32';
  const isMacOS = process.platform === 'darwin';
  const hasLocalSupport = isWindows || isMacOS;

  return hasLocalSupport || hasOpenAI || hasElevenLabs;
}

/**
 * Full runtime check: feature gate + auth/platform readiness.
 * Used for deciding whether voice mode should be visible in commands or UI.
 * 
 * Pattern: Composite check (Feature Flag && Auth)
 * Callers:
 * - Command registration (/voice)
 * - UI components (Microphone button)
 * - Agent loop (TTS feedback)
 */
export function isVoiceModeEnabled(): boolean {
  return isVoiceFeatureEnabled() && hasVoiceAuth();
}
