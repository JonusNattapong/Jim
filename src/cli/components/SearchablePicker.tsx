import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";

export interface SearchablePickerItem {
  label: string;
  value: string;
  description?: string;
  keywords?: string[];
}

type PickerEntry =
  | { type: "heading"; id: string; label: string }
  | { type: "item"; item: SearchablePickerItem };

interface SearchablePickerProps {
  title: string;
  items: SearchablePickerItem[];
  favorites?: string[];
  recents?: string[];
  onSelect: (value: string) => void | Promise<void>;
  onToggleFavorite?: (value: string) => void;
  onCancel: () => void;
}

export const SearchablePicker: React.FC<SearchablePickerProps> = ({
  title,
  items,
  favorites = [],
  recents = [],
  onSelect,
  onToggleFavorite,
  onCancel,
}) => {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => {
      const af = favorites.includes(a.value) ? 1 : 0;
      const bf = favorites.includes(b.value) ? 1 : 0;
      if (af !== bf) return bf - af;
      const ar = recents.indexOf(a.value);
      const br = recents.indexOf(b.value);
      if (ar !== -1 || br !== -1) {
        if (ar === -1) return 1;
        if (br === -1) return -1;
        return ar - br;
      }
      return a.label.localeCompare(b.label);
    });

    if (!needle) return sorted;
    return sorted.filter((item) => {
      const haystack = [item.label, item.description ?? "", ...(item.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, favorites, recents]);

  const visibleEntries = useMemo<PickerEntry[]>(() => {
    if (query.trim()) {
      return filteredItems.length > 0
        ? [{ type: "heading", id: "matches", label: "Matches" }, ...filteredItems.map((item): PickerEntry => ({ type: "item", item }))]
        : [];
    }

    const favoriteSet = new Set(favorites);
    const recentSet = new Set(recents);
    const favoritesList = filteredItems.filter((item) => favoriteSet.has(item.value));
    const recentsList = filteredItems.filter((item) => !favoriteSet.has(item.value) && recentSet.has(item.value));
    const othersList = filteredItems.filter((item) => !favoriteSet.has(item.value) && !recentSet.has(item.value));

    const entries: PickerEntry[] = [];
    if (favoritesList.length > 0) {
      entries.push({ type: "heading", id: "favorites", label: "Favorites" });
      entries.push(...favoritesList.map((item): PickerEntry => ({ type: "item", item })));
    }
    if (recentsList.length > 0) {
      entries.push({ type: "heading", id: "recent", label: "Recent" });
      entries.push(...recentsList.map((item): PickerEntry => ({ type: "item", item })));
    }
    if (othersList.length > 0) {
      entries.push({ type: "heading", id: "all", label: favoritesList.length > 0 || recentsList.length > 0 ? "All" : "Available" });
      entries.push(...othersList.map((item): PickerEntry => ({ type: "item", item })));
    }

    return entries;
  }, [favorites, filteredItems, query, recents]);

  const visibleItems = useMemo(
    () => visibleEntries.filter((entry): entry is Extract<PickerEntry, { type: "item" }> => entry.type === "item"),
    [visibleEntries],
  );

  useEffect(() => {
    if (index >= visibleItems.length) setIndex(Math.max(0, visibleItems.length - 1));
  }, [visibleItems.length, index]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setIndex((prev) => (prev <= 0 ? Math.max(0, visibleItems.length - 1) : prev - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((prev) => (prev + 1) % Math.max(visibleItems.length, 1));
      return;
    }
    if (key.ctrl && input === "f" && onToggleFavorite && visibleItems[index]) {
      onToggleFavorite(visibleItems[index].item.value);
      return;
    }
    if (key.return && visibleItems[index]) {
      void onSelect(visibleItems[index].item.value);
    }
  });

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1} borderStyle="round" borderColor={theme.warning} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color={theme.warning}>{title}</Text>
        <Text dimColor>esc</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.primary}>Search </Text>
        <TextInput value={query} onChange={setQuery} placeholder="type to filter..." />
      </Box>
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>↑/↓ move · enter select · ctrl+f favorite</Text>
      </Box>
      {visibleItems.length === 0 && (
        <Text dimColor>No matches</Text>
      )}
      {(() => {
        // Calculate windowed view
        const windowSize = 10;
        let itemCounter = -1;
        const mapped = visibleEntries.map((e, idx) => {
          if (e.type === "item") itemCounter++;
          const isSelected = e.type === "item" && itemCounter === index;
          return { ...e, isSelected, globalIndex: idx };
        });

        const selectedIdx = mapped.findIndex(m => m.isSelected);
        const pivot = selectedIdx === -1 ? 0 : selectedIdx;
        let start = Math.max(0, pivot - Math.floor(windowSize / 2));
        let end = Math.min(mapped.length, start + windowSize);

        if (end - start < windowSize) {
          start = Math.max(0, end - windowSize);
        }

        const windowed = mapped.slice(start, end);

        return (
          <Box flexDirection="column">
            {start > 0 && (
              <Box justifyContent="center">
                <Text dimColor>↑ more above ({start})</Text>
              </Box>
            )}
            {windowed.map((entry) => {
              if (entry.type === "heading") {
                return (
                  <Box key={entry.id} marginTop={1} marginBottom={0}>
                    <Text bold color={theme.warning}>{entry.label}</Text>
                  </Box>
                );
              }

              const item = entry.item;
              const active = entry.isSelected;
              const favorite = favorites.includes(item.value);
              const recent = recents.includes(item.value);

              return (
                <Box key={item.value} flexDirection="column" marginTop={0} marginBottom={1}>
                  <Box>
                    <Text bold={active} color={active ? theme.inverse : theme.text} backgroundColor={active ? theme.warning : undefined}>
                      {active ? " ❯ " : "   "}
                      {favorite ? "★ " : recent ? "• " : "  "}
                      {item.label}
                    </Text>
                  </Box>
                  {item.description && (
                    <Box marginLeft={5}>
                      <Text dimColor italic={!active}>{item.description}</Text>
                    </Box>
                  )}
                </Box>
              );
            })}
            {end < mapped.length && (
              <Box justifyContent="center">
                <Text dimColor>↓ more below ({mapped.length - end})</Text>
              </Box>
            )}
          </Box>
        );
      })()}
    </Box>
  );
};
