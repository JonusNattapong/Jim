import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface ProviderStoreData {
  selectedPreset?: string;
  settings?: Record<string, Record<string, string>>;
}

function getProviderStorePath(projectRoot: string): string {
  return join(projectRoot, ".jim", "provider.json");
}

function readStore(projectRoot: string): ProviderStoreData {
  try {
    const path = getProviderStorePath(projectRoot);
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf8")) as ProviderStoreData;
  } catch {
    return {};
  }
}

function writeStore(projectRoot: string, data: ProviderStoreData): void {
  const path = getProviderStorePath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

export function loadSavedProviderSelection(projectRoot: string): string | undefined {
  return readStore(projectRoot).selectedPreset;
}

export function saveProviderSelection(projectRoot: string, preset: string): void {
  const data = readStore(projectRoot);
  writeStore(projectRoot, { ...data, selectedPreset: preset });
}

export function loadProviderSettings(projectRoot: string, preset: string): Record<string, string> {
  return readStore(projectRoot).settings?.[preset] ?? {};
}

export function saveProviderSettings(projectRoot: string, preset: string, settings: Record<string, string>): void {
  const data = readStore(projectRoot);
  writeStore(projectRoot, {
    ...data,
    settings: {
      ...(data.settings ?? {}),
      [preset]: settings,
    },
  });
}
