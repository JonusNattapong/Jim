/**
 * Comprehensive Utils Library for Jim
 * Expanded from ~10 to 50+ essential utilities matching Claude Code's 200+ utils
 */

// ─── Error Handling ─────────────────────────────────────
export class JimError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "JimError";
  }
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export function errorToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ─── Retry Logic ─────────────────────────────────────────
export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoff?: "linear" | "exponential";
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === options.maxAttempts) break;
      options.onRetry?.(attempt, err);
      const delay =
        options.backoff === "exponential"
          ? options.delayMs * Math.pow(2, attempt - 1)
          : options.delayMs * attempt;
      await sleep(delay);
    }
  }
  throw lastError;
}

// ─── Sleep & Timing ─────────────────────────────────────
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ─── String Utilities ────────────────────────────────────
export function truncate(str: string, maxLen: number, suffix = "..."): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - suffix.length) + suffix;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function indent(str: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return str
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}

export function dedent(str: string): string {
  const lines = str.split("\n");
  const minIndent = lines
    .filter((l) => l.trim())
    .reduce((min, line) => {
      const match = line.match(/^(\s*)/);
      return Math.min(min, match ? match[1].length : 0);
    }, Infinity);
  return lines.map((l) => l.slice(minIndent)).join("\n");
}

// ─── Path Utilities ──────────────────────────────────────
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}

export function getExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function getBasename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

export function getDirname(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

export function isAbsolute(p: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(p) || p.startsWith("/");
}

export function relativeTo(from: string, to: string): string {
  const fromParts = normalizePath(from).split("/");
  const toParts = normalizePath(to).split("/");

  let i = 0;
  while (
    i < fromParts.length &&
    i < toParts.length &&
    fromParts[i] === toParts[i]
  ) {
    i++;
  }

  const upCount = fromParts.length - i;
  const downParts = toParts.slice(i);

  return [...Array(upCount).fill(".."), ...downParts].join("/");
}

// ─── Object Utilities ────────────────────────────────────
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function merge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = merge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey),
      );
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// ─── Array Utilities ─────────────────────────────────────
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const groupKey = String(item[key]);
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
  }
  return result;
}

export function sortBy<T>(
  arr: T[],
  key: keyof T,
  order: "asc" | "desc" = "asc",
): T[] {
  return [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

// ─── Type Guards ─────────────────────────────────────────
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// ─── Validation ──────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// ─── Formatting ──────────────────────────────────────────
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

// ─── Hash & Crypto ───────────────────────────────────────
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateId(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Process Management ──────────────────────────────────
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getEnv(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? "";
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value)
    throw new JimError(`Missing required env var: ${key}`, "MISSING_ENV");
  return value;
}

// ─── Abort Controller ────────────────────────────────────
export function createAbortController(timeoutMs?: number): AbortController {
  const controller = new AbortController();
  if (timeoutMs) {
    setTimeout(() => controller.abort(), timeoutMs);
  }
  return controller;
}

export function mergeAbortSignals(...signals: AbortSignal[]): AbortController {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller;
}

// ─── Logging Helpers ─────────────────────────────────────
export function createLogger(prefix: string) {
  return {
    info: (...args: unknown[]) => console.log(`[${prefix}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${prefix}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${prefix}]`, ...args),
    debug: (...args: unknown[]) => {
      if (process.env.DEBUG) console.log(`[${prefix}:DEBUG]`, ...args);
    },
  };
}

// ─── Performance Tracking ────────────────────────────────
export class PerformanceTracker {
  private marks = new Map<string, number>();

  start(label: string): void {
    this.marks.set(label, performance.now());
  }

  end(label: string): number {
    const start = this.marks.get(label);
    if (!start) return 0;
    const duration = performance.now() - start;
    this.marks.delete(label);
    return duration;
  }

  measure<T>(label: string, fn: () => T): T {
    this.start(label);
    const result = fn();
    const duration = this.end(label);
    console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    const result = await fn();
    const duration = this.end(label);
    console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  }
}

// ─── Clipboard (cross-platform) ──────────────────────────
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const { execSync } = await import("child_process");
    if (process.platform === "win32") {
      execSync("clip", { input: text });
    } else if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else {
      execSync("xclip -selection clipboard", { input: text });
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Security ────────────────────────────────────────────
export function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "&#039;");
}

export function maskSensitive(str: string, visibleChars = 4): string {
  if (str.length <= visibleChars) return "*".repeat(str.length);
  return str.slice(0, visibleChars) + "*".repeat(str.length - visibleChars);
}

// ─── Network Utilities ───────────────────────────────────
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── JSON Utilities ──────────────────────────────────────
export function safeJsonParse<T = unknown>(
  str: string,
  fallback?: T,
): T | undefined {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(obj: unknown, indent?: number): string {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
}

// ─── Activity Tracking ──────────────────────────────────
export class ActivityTracker {
  private activities: Array<{
    type: string;
    timestamp: number;
    data: unknown;
  }> = [];
  private maxActivities = 1000;

  track(type: string, data: unknown = {}): void {
    this.activities.push({ type, timestamp: Date.now(), data });
    if (this.activities.length > this.maxActivities) {
      this.activities = this.activities.slice(-this.maxActivities);
    }
  }

  getRecent(
    count: number = 10,
  ): Array<{ type: string; timestamp: number; data: unknown }> {
    return this.activities.slice(-count);
  }

  getByType(
    type: string,
  ): Array<{ type: string; timestamp: number; data: unknown }> {
    return this.activities.filter((a) => a.type === type);
  }

  clear(): void {
    this.activities = [];
  }
}

// ─── Auth Helpers ────────────────────────────────────────
export function encodeBase64(str: string): string {
  return Buffer.from(str).toString("base64");
}

export function decodeBase64(str: string): string {
  return Buffer.from(str, "base64").toString("utf-8");
}

export function encodeBasicAuth(username: string, password: string): string {
  return `Basic ${encodeBase64(`${username}:${password}`)}`;
}

export function parseBasicAuth(
  header: string,
): { username: string; password: string } | null {
  if (!header.startsWith("Basic ")) return null;
  const decoded = decodeBase64(header.slice(6));
  const [username, ...rest] = decoded.split(":");
  return { username, password: rest.join(":") };
}

export function encodeBearerAuth(token: string): string {
  return `Bearer ${token}`;
}

// ─── Date/Time Utilities ────────────────────────────────
export function toIsoString(date: Date = new Date()): string {
  return date.toISOString();
}

export function fromIsoString(str: string): Date {
  return new Date(str);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(date: Date): boolean {
  const yesterday = addDays(new Date(), -1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

export function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long" });
}

// ─── File System Utilities ──────────────────────────────
export async function fileExists(path: string): Promise<boolean> {
  try {
    const fs = await import("fs/promises");
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function directoryExists(path: string): Promise<boolean> {
  try {
    const fs = await import("fs/promises");
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(path, { recursive: true });
}

export async function readFileContent(path: string): Promise<string> {
  const fs = await import("fs/promises");
  return fs.readFile(path, "utf-8");
}

export async function writeFileContent(
  path: string,
  content: string,
): Promise<void> {
  const fs = await import("fs/promises");
  await fs.writeFile(path, content, "utf-8");
}

export async function deleteFile(path: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.unlink(path);
}

export async function copyFile(src: string, dest: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.copyFile(src, dest);
}

export async function moveFile(src: string, dest: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rename(src, dest);
}

export async function getFileSize(path: string): Promise<number> {
  const fs = await import("fs/promises");
  const stat = await fs.stat(path);
  return stat.size;
}

export async function listDirectory(path: string): Promise<string[]> {
  const fs = await import("fs/promises");
  return fs.readdir(path);
}

// ─── Hash Utilities ─────────────────────────────────────
export async function md5(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("MD5", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha1(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256(data: string): Promise<string> {
  return hashString(data);
}

// ─── Math Utilities ─────────────────────────────────────
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

// ─── URL Utilities ──────────────────────────────────────
export function parseUrl(url: string): URL {
  return new URL(url);
}

export function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function extractQueryParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const params: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function getDomain(url: string): string {
  return new URL(url).hostname;
}

export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function joinUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

// ─── Terminal Utilities ─────────────────────────────────
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[0f");
}

export function moveCursor(x: number, y: number): void {
  process.stdout.write(`\x1b[${y};${x}H`);
}

export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

export function setColor(color: string): string {
  const colors: Record<string, string> = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    reset: "\x1b[0m",
  };
  return colors[color] ?? colors.reset;
}

export function setBold(): string {
  return "\x1b[1m";
}

export function setDim(): string {
  return "\x1b[2m";
}

export function setUnderline(): string {
  return "\x1b[4m";
}

export function resetFormat(): string {
  return "\x1b[0m";
}

// ─── Process Utilities ──────────────────────────────────
export function getProcessId(): number {
  return process.pid;
}

export function getProcessMemory(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

export function getProcessUptime(): number {
  return process.uptime();
}

export function getProcessPlatform(): string {
  return process.platform;
}

export function getProcessArch(): string {
  return process.arch;
}

export function getProcessNodeVersion(): string {
  return process.version;
}

export function getProcessEnv(key: string, fallback: string = ""): string {
  return process.env[key] ?? fallback;
}

export function setProcessEnv(key: string, value: string): void {
  process.env[key] = value;
}

export function getProcessArgs(): string[] {
  return process.argv;
}

export function exitProcess(code: number = 0): void {
  process.exit(code);
}

// ─── Validation Utilities ───────────────────────────────
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isFloat(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

export function isPort(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 65535;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function isRgbColor(value: string): boolean {
  return /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(value);
}

export function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value);
}

export function isAlpha(value: string): boolean {
  return /^[a-zA-Z]+$/.test(value);
}

export function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

export function isWhitespace(value: string): boolean {
  return /^\s+$/.test(value);
}

export function isEmptyString(value: string): boolean {
  return value.trim().length === 0;
}

export function isPalindrome(value: string): boolean {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}

// ─── Concurrency Utilities ──────────────────────────────
export async function parallel<T>(
  tasks: Array<() => Promise<T>>,
): Promise<T[]> {
  return Promise.all(tasks.map((task) => task()));
}

export async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
    });
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1,
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export async function race<T>(tasks: Array<() => Promise<T>>): Promise<T> {
  return Promise.race(tasks.map((task) => task()));
}

export async function allSettled<T>(
  tasks: Array<() => Promise<T>>,
): Promise<
  Array<{ status: "fulfilled" | "rejected"; value?: T; reason?: unknown }>
> {
  return Promise.all(
    tasks.map((task) =>
      task()
        .then((value) => ({ status: "fulfilled" as const, value }))
        .catch((reason) => ({ status: "rejected" as const, reason })),
    ),
  );
}

// ─── Queue Utilities ────────────────────────────────────
export class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): T[] {
    return [...this.items];
  }
}

// ─── Stack Utilities ────────────────────────────────────
export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): T[] {
    return [...this.items];
  }
}

// ─── LRU Cache ──────────────────────────────────────────
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ─── Event Emitter Utility ──────────────────────────────
export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<(data: unknown) => void>>();

  on<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
  }

  off<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(handler as (data: unknown) => void);
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
