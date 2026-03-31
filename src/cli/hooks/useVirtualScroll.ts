import { useMemo } from "react";

/**
 * A simplified virtual scroll hook for Jim.
 * Instead of complex Yoga measurements, it focuses on limiting the rendered
 * items to a window around the viewport.
 */
export function useVirtualScroll<T>(
  items: T[],
  windowSize: number = 50,
  buffer: number = 10
) {
  // For now, we simply return the last N items to keep it smooth.
  // In a real TUI, scroll position matters, but this is a great first step
  // to prevent rendering performance death as history grows.
  const visibleRange = useMemo(() => {
    if (items.length <= windowSize) {
      return {
        items: items,
        startIndex: 0,
        totalItems: items.length
      };
    }

    const start = Math.max(0, items.length - windowSize);
    return {
      items: items.slice(start),
      startIndex: start,
      totalItems: items.length
    };
  }, [items, windowSize]);

  return visibleRange;
}
