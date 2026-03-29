import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createDiff } from "./diff.js";

export interface DiffPreview {
  filePath: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Generate a preview diff for an edit_file tool call without executing it.
 */
export async function previewEditDiff(args: Record<string, unknown>): Promise<DiffPreview | null> {
  const filePath = args.path as string;
  const startLine = args.start_line as number;
  const endLine = args.end_line as number;
  const newText = args.new_text as string;

  if (!filePath || !startLine || !endLine || newText == null) return null;

  try {
    const absPath = resolve(filePath);
    const content = await readFile(absPath, "utf-8");
    const lines = content.split(/\r?\n/);

    if (startLine < 1 || startLine > lines.length + 1) return null;
    if (endLine < startLine) return null;

    const oldText = lines.slice(startLine - 1, endLine).join("\n");
    const diff = createDiff(oldText, newText);

    const diffLines = diff.split("\n");
    const linesAdded = diffLines.filter(l => l.startsWith("+")).length;
    const linesRemoved = diffLines.filter(l => l.startsWith("-")).length;

    return {
      filePath: relative(process.cwd(), absPath),
      diff,
      linesAdded,
      linesRemoved,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a preview diff for a write_file tool call without executing it.
 */
export async function previewWriteDiff(args: Record<string, unknown>): Promise<DiffPreview | null> {
  const filePath = args.path as string;
  const content = args.content as string;

  if (!filePath || content == null) return null;

  try {
    const absPath = resolve(filePath);
    const newLines = content.split(/\r?\n/);

    let existingContent: string | null = null;
    try {
      existingContent = await readFile(absPath, "utf-8");
    } catch { /* new file */ }

    let diff: string;
    if (existingContent != null) {
      diff = createDiff(existingContent, content);
    } else {
      diff = newLines.map(l => "+ " + (l || " ")).join("\n");
    }

    const diffLines = diff.split("\n");
    const linesAdded = diffLines.filter(l => l.startsWith("+")).length;
    const linesRemoved = diffLines.filter(l => l.startsWith("-")).length;

    return {
      filePath: relative(process.cwd(), absPath),
      diff,
      linesAdded,
      linesRemoved,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a preview diff for any supported tool call.
 */
export async function generatePreviewDiff(
  toolName: string,
  args: Record<string, unknown>,
): Promise<DiffPreview | null> {
  if (toolName === "edit_file") return previewEditDiff(args);
  if (toolName === "write_file") return previewWriteDiff(args);
  return null;
}
