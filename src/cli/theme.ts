/**
 * Nord Minimal Theme for JimCode CLI
 *
 * Based on the Nord color palette: https://www.nordtheme.com/
 * Adapted for terminal/Ink TUI with readable contrast.
 */

export const theme = {
  // ── Primary accent (Warm Orange) ──
  primary: "#FF914D" as const,       
  primaryBright: "#FFB085" as const, 

  // ── Secondary accent (Clean White/Gray) ──
  secondary: "#EAEAEA" as const,     
  secondaryDark: "#A0A0A0" as const, 

  // ── Semantic colors (Curated tones) ──
  success: "#81C784" as const,       
  warning: "#FFD54F" as const,       
  error: "#E57373" as const,         
  info: "#64B5F6" as const,          
  accent: "#FF7043" as const,        

  // ── Text colors ──
  text: "#F5F5F5" as const,          
  textBright: "#FFFFFF" as const,    
  textMuted: "#BDBDBD" as const,     
  inverse: "#1A1A1A" as const,

  // ── Borders ──
  border: "#333333" as const,        
  borderAccent: "#FF914D" as const,  

  // ── Diff colors ──
  diffAddBg: "#2E7D32" as const,     
  diffAddFg: "#FFFFFF" as const,     
  diffRemBg: "#C62828" as const,     
  diffRemFg: "#FFFFFF" as const,     

  // ── Ink semantic mappings ──
  color: {
    primary: "#FF914D" as const,
    primaryBold: "#FF914D" as const,
    secondary: "#EAEAEA" as const,
    success: "#81C784" as const,
    warning: "#FFD54F" as const,
    error: "#E57373" as const,
    text: "#F5F5F5" as const,
    textBright: "#FFFFFF" as const,
    accent: "#FF7043" as const,
    info: "#64B5F6" as const,
  },
} as const;

export type ThemeColor = keyof typeof theme.color;
