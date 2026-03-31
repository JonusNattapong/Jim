/**
 * Curated color themes for the JimCode CLI.
 */

export interface Theme {
  id: string;
  label: string;
  primary: string;
  primaryBright: string;
  secondary: string;
  secondaryDark: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  accent: string;
  text: string;
  textBright: string;
  textMuted: string;
  inverse: string;
  border: string;
  borderAccent: string;
  diffAddBg: string;
  diffAddFg: string;
  diffRemBg: string;
  diffRemFg: string;
}

export const THEME_LIST: Theme[] = [
  {
    id: "sunset",
    label: "Sunset Orange (Premium)",
    primary: "#FF914D",
    primaryBright: "#FFB085",
    secondary: "#EAEAEA",
    secondaryDark: "#A0A0A0",
    success: "#81C784",
    warning: "#FFD54F",
    error: "#E57373",
    info: "#64B5F6",
    accent: "#FF7043",
    text: "#F5F5F5",
    textBright: "#FFFFFF",
    textMuted: "#BDBDBD",
    inverse: "#1A1A1A",
    border: "#333333",
    borderAccent: "#FF914D",
    diffAddBg: "#2E7D32",
    diffAddFg: "#FFFFFF",
    diffRemBg: "#C62828",
    diffRemFg: "#FFFFFF",
  },
  {
    id: "nord",
    label: "Nord (Classic)",
    primary: "#88C0D0",
    primaryBright: "#8FBCBB",
    secondary: "#ECEFF4",
    secondaryDark: "#D8DEE9",
    success: "#A3BE8C",
    warning: "#EBCB8B",
    error: "#BF616A",
    info: "#81A1C1",
    accent: "#B48EAD",
    text: "#D8DEE9",
    textBright: "#E5E9F0",
    textMuted: "#4C566A",
    inverse: "#2E3440",
    border: "#3B4252",
    borderAccent: "#88C0D0",
    diffAddBg: "#3B4252",
    diffAddFg: "#A3BE8C",
    diffRemBg: "#3B4252",
    diffRemFg: "#BF616A",
  },
  {
    id: "matrix",
    label: "Matrix (Hacker)",
    primary: "#00FF41",
    primaryBright: "#00FF00",
    secondary: "#0D0208",
    secondaryDark: "#003B00",
    success: "#008F11",
    warning: "#FFFB00",
    error: "#FF0000",
    info: "#00FF41",
    accent: "#00FF41",
    text: "#00FF41",
    textBright: "#FFFFFF",
    textMuted: "#003B00",
    inverse: "#000000",
    border: "#003B00",
    borderAccent: "#00FF41",
    diffAddBg: "#003B00",
    diffAddFg: "#00FF41",
    diffRemBg: "#3B0000",
    diffRemFg: "#FF0000",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk (Neon)",
    primary: "#F300FF",
    primaryBright: "#FF00E5",
    secondary: "#00FFD1",
    secondaryDark: "#009B80",
    success: "#00FFD1",
    warning: "#FFFF00",
    error: "#FF003C",
    info: "#00FFD1",
    accent: "#FF003C",
    text: "#FFFFFF",
    textBright: "#FFFFFF",
    textMuted: "#66006B",
    inverse: "#000000",
    border: "#330036",
    borderAccent: "#F300FF",
    diffAddBg: "#00332A",
    diffAddFg: "#00FFD1",
    diffRemBg: "#33000C",
    diffRemFg: "#FF003C",
  },
  {
    id: "midnight",
    label: "Midnight (Deep)",
    primary: "#7C4DFF",
    primaryBright: "#B388FF",
    secondary: "#FFFFFF",
    secondaryDark: "#B0BEC5",
    success: "#00E676",
    warning: "#FFD600",
    error: "#FF1744",
    info: "#00B0FF",
    accent: "#FF4081",
    text: "#ECEFF1",
    textBright: "#FFFFFF",
    textMuted: "#546E7A",
    inverse: "#121212",
    border: "#263238",
    borderAccent: "#7C4DFF",
    diffAddBg: "#1B5E20",
    diffAddFg: "#FFFFFF",
    diffRemBg: "#B71C1C",
    diffRemFg: "#FFFFFF",
  }
];

export const DEFAULT_THEME_ID = "sunset";

// Fallback theme object to avoid breaking existing imports
export const theme: Theme = { ...(THEME_LIST.find(t => t.id === DEFAULT_THEME_ID) || THEME_LIST[0]) };

export function setTheme(themeId: string) {
  const found = THEME_LIST.find(t => t.id === themeId);
  if (found) {
    Object.assign(theme, found);
  }
}
