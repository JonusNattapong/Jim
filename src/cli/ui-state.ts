import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface CliUiState {
  recentModels: string[];
  favoriteModels: string[];
  recentProviders: string[];
  favoriteProviders: string[];
  recentConnections: string[];
  favoriteConnections: string[];
  promptHistory: string[];
  themeId: string;
  showHeader: boolean;
  isOutputExpanded: boolean;
}

const DEFAULT_STATE: CliUiState = {
  recentModels: [],
  favoriteModels: [],
  recentProviders: [],
  favoriteProviders: [],
  recentConnections: [],
  favoriteConnections: [],
  promptHistory: [],
  themeId: "sunset",
  showHeader: true,
  isOutputExpanded: false,
};

function getUiStatePath(projectRoot: string): string {
  return join(projectRoot, ".jim", "ui-state.json");
}

export function loadCliUiState(projectRoot: string): CliUiState {
  try {
    const path = getUiStatePath(projectRoot);
    if (!existsSync(path)) return { ...DEFAULT_STATE };
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<CliUiState>;
    return {
      recentModels: raw.recentModels ?? [],
      favoriteModels: raw.favoriteModels ?? [],
      recentProviders: raw.recentProviders ?? [],
      favoriteProviders: raw.favoriteProviders ?? [],
      recentConnections: raw.recentConnections ?? [],
      favoriteConnections: raw.favoriteConnections ?? [],
      promptHistory: raw.promptHistory ?? [],
      themeId: raw.themeId ?? "sunset",
      showHeader: raw.showHeader ?? true,
      isOutputExpanded: raw.isOutputExpanded ?? false,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveCliUiState(projectRoot: string, state: CliUiState): void {
  const path = getUiStatePath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
}

export function pushRecent(list: string[], value: string, max = 8): string[] {
  return [value, ...list.filter((item) => item !== value)].slice(0, max);
}

export function toggleFavorite(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [value, ...list];
}

export function pushPromptHistory(list: string[], value: string, max = 50): string[] {
  const normalized = value.trim();
  if (!normalized) {
    return list;
  }

  return [normalized, ...list.filter((item) => item !== normalized)].slice(0, max);
}
