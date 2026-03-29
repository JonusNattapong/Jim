/**
 * Simple line-based diff generator for terminal display.
 */
export function createDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diff: string[] = [];

  // This is a simple naivé diff because we know exactly what block was replaced.
  // Real diffs use Myers algorithm, but here we just show - and + for the whole block
  // because Jim usually replaces an entire function or block.

  oldLines.forEach(line => {
    diff.push(`- ${line}`);
  });
  newLines.forEach(line => {
    diff.push(`+ ${line}`);
  });

  return diff.join("\n");
}
