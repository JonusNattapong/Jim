/**
 * Theme System with ThemeProvider/useTheme hook
 * Inspired by Claude Code's design system
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Theme definitions
export interface Theme {
  // Colors
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Text colors
  text: string;
  textBright: string;
  textMuted: string;
  inverse: string;
  
  // Background colors
  background: string;
  backgroundAlt: string;
  
  // Border colors
  border: string;
  borderBright: string;
  
  // Diff colors
  diffAdded: string;
  diffRemoved: string;
  diffAddedWord: string;
  diffRemovedWord: string;
  diffAddedDimmed: string;
  diffRemovedDimmed: string;
  
  // Spinner colors
  spinnerPrimary: string;
  spinnerSecondary: string;
  spinnerSuccess: string;
  spinnerError: string;
  spinnerWarning: string;
}

// Theme presets
export const themes: Record<string, Theme> = {
  default: {
    // Colors
    primary: "#6366f1", // Indigo
    secondary: "#8b5cf6", // Violet
    success: "#10b981", // Emerald
    error: "#ef4444", // Red
    warning: "#f59e0b", // Amber
    info: "#3b82f6", // Blue
    
    // Text colors
    text: "#f8fafc", // Slate 50
    textBright: "#ffffff",
    textMuted: "#94a3b8", // Slate 400
    inverse: "#0f172a", // Slate 900
    
    // Background colors
    background: "#0f172a", // Slate 900
    backgroundAlt: "#1e293b", // Slate 800
    
    // Border colors
    border: "#334155", // Slate 700
    borderBright: "#475569", // Slate 600
    
    // Diff colors
    diffAdded: "#166534", // Green 800
    diffRemoved: "#991b1b", // Red 800
    diffAddedWord: "#4ade80", // Green 400
    diffRemovedWord: "#f87171", // Red 400
    diffAddedDimmed: "#14532d", // Green 900
    diffRemovedDimmed: "#7f1d1d", // Red 900
    
    // Spinner colors
    spinnerPrimary: "#6366f1", // Indigo
    spinnerSecondary: "#8b5cf6", // Violet
    spinnerSuccess: "#10b981", // Emerald
    spinnerError: "#ef4444", // Red
    spinnerWarning: "#f59e0b", // Amber
  },
  
  light: {
    // Colors
    primary: "#4f46e5", // Indigo 600
    secondary: "#7c3aed", // Violet 600
    success: "#059669", // Emerald 600
    error: "#dc2626", // Red 600
    warning: "#d97706", // Amber 600
    info: "#2563eb", // Blue 600
    
    // Text colors
    text: "#0f172a", // Slate 900
    textBright: "#000000",
    textMuted: "#64748b", // Slate 500
    inverse: "#f8fafc", // Slate 50
    
    // Background colors
    background: "#ffffff",
    backgroundAlt: "#f8fafc", // Slate 50
    
    // Border colors
    border: "#e2e8f0", // Slate 200
    borderBright: "#cbd5e1", // Slate 300
    
    // Diff colors
    diffAdded: "#dcfce7", // Green 100
    diffRemoved: "#fee2e2", // Red 100
    diffAddedWord: "#16a34a", // Green 600
    diffRemovedWord: "#dc2626", // Red 600
    diffAddedDimmed: "#f0fdf4", // Green 50
    diffRemovedDimmed: "#fef2f2", // Red 50
    
    // Spinner colors
    spinnerPrimary: "#4f46e5", // Indigo 600
    spinnerSecondary: "#7c3aed", // Violet 600
    spinnerSuccess: "#059669", // Emerald 600
    spinnerError: "#dc2626", // Red 600
    spinnerWarning: "#d97706", // Amber 600
  },
};

// Theme context
interface ThemeContextType {
  theme: Theme;
  themeName: string;
  setTheme: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: themes.default,
  themeName: "default",
  setTheme: () => {},
});

// Theme provider component
interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme = "default" 
}) => {
  const [themeName, setThemeName] = useState(initialTheme);
  const theme = themes[themeName] || themes.default;
  
  const setTheme = (name: string) => {
    if (themes[name]) {
      setThemeName(name);
    }
  };
  
  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// useTheme hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// useThemeValue hook for accessing specific theme values
export const useThemeValue = <K extends keyof Theme>(key: K): Theme[K] => {
  const { theme } = useTheme();
  return theme[key];
};

// useThemeColor hook for accessing color values
export const useThemeColor = (colorKey: keyof Theme): string => {
  const { theme } = useTheme();
  return theme[colorKey] as string;
};

// useThemeMode hook for light/dark mode switching
export const useThemeMode = () => {
  const { themeName, setTheme } = useTheme();
  
  const toggleMode = () => {
    setTheme(themeName === "default" ? "light" : "default");
  };
  
  const setLightMode = () => setTheme("light");
  const setDarkMode = () => setTheme("default");
  
  return {
    isDarkMode: themeName === "default",
    isLightMode: themeName === "light",
    toggleMode,
    setLightMode,
    setDarkMode,
  };
};

// Legacy export for backward compatibility
export const theme = themes.default;