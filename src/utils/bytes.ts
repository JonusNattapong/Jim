/**
 * @fileoverview Utility functions for formatting data into human-readable strings.
 */

/**
 * Unit sizes for byte formatting.
 */
const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

/**
 * Formats a byte count into a human-readable string.
 *
 * @param bytes - The number of bytes to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "1.5 KB", "2.3 MB", etc.
 *
 * @example
 * ```ts
 * formatBytes(1024)       // "1.0 KB"
 * formatBytes(1536)      // "1.5 KB"
 * formatBytes(1048576)   // "1.0 MB"
 * formatBytes(5000000000) // "4.7 GB"
 * ```
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("Bytes must be a non-negative finite number");
  }

  if (bytes === 0) {
    return "0 B";
  }

  const k = 1024;
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  let value = bytes / Math.pow(k, i);

  // If value is exactly 1024 or larger, step up to next unit
  if (value >= 1024) {
    i++;
    value /= k;
  }

  // Cap at max unit
  i = Math.min(i, UNITS.length - 1);

  return `${value.toFixed(decimals)} ${UNITS[i]}`;
}