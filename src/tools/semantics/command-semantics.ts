/**
 * Command Semantics Engine
 * Handles exit code interpretation for tools like grep, rg, find, etc.
 * Exit codes don't always mean errors - need custom semantics per command
 */

export interface ExitCodeSemantics {
  isError: boolean;
  message?: string;
  shouldRetry?: boolean;
}

export type CommandSemantic = (
  exitCode: number,
  stdout: string,
  stderr: string,
) => ExitCodeSemantics;

/**
 * Command-specific exit code handlers
 * Different commands use exit codes differently:
 * - grep/rg: 1 = no matches (not an error), 2+ = actual error
 * - find: 0 = success, 1 = partial success (found some but had permissions issues), 2 = error
 * - git: varies widely per subcommand
 */
export const COMMAND_SEMANTICS: Map<string, CommandSemantic> = new Map([
  // Ripgrep: 0 = match found, 1 = no match, 2+ = error
  [
    "rg",
    (code, stdout, stderr) => {
      if (code === 0 || code === 1) {
        return {
          isError: false,
          message: code === 1 ? "No matches found" : undefined,
        };
      }
      return {
        isError: true,
        message: `ripgrep error (exit ${code}): ${stderr || stdout}`,
      };
    },
  ],

  // Grep: 0 = match, 1 = no match, 2 = error
  [
    "grep",
    (code, stdout, stderr) => {
      if (code === 0 || code === 1) {
        return {
          isError: false,
          message: code === 1 ? "No matches found" : undefined,
        };
      }
      return {
        isError: true,
        message: `grep error (exit ${code}): ${stderr}`,
      };
    },
  ],

  // Find: 0 = success, 1 = partial success, 2 = error
  [
    "find",
    (code, stdout, stderr) => {
      if (code === 0) {
        return { isError: false };
      }
      if (code === 1) {
        return {
          isError: false,
          message: "Found results but encountered some permission denied errors",
        };
      }
      return {
        isError: true,
        message: `find error (exit ${code}): ${stderr}`,
      };
    },
  ],

  // Git commands: generally any non-zero is an error
  [
    "git",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      
      // Common git errors with better messages
      if (stderr.includes("not a git repository")) {
        return { isError: true, message: "Not a git repository - run 'git init' first" };
      }
      if (stderr.includes("merge conflict")) {
        return { isError: true, message: "Git merge conflict - resolve conflicts in conflicted files" };
      }
      if (stderr.includes("refused to merge")) {
        return { isError: true, message: "Git merge refused - working tree has uncommitted changes" };
      }
      if (stderr.includes("Authentication failed") || stderr.includes("Permission denied")) {
        return { isError: true, message: "Git authentication failed - check SSH key or credentials" };
      }
      
      return {
        isError: true,
        message: `git error (exit ${code}): ${stderr || stdout}`,
      };
    },
  ],

  // npm/pnpm commands: some non-zero codes need interpretation
  [
    "npm",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      
      if (stderr.includes("ERR!")) {
        return { isError: true, message: `npm error: ${stderr.split("\n")[0]}` };
      }
      
      return { isError: true, message: `npm failed (exit ${code})` };
    },
  ],

  // pnpm
  [
    "pnpm",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      return { isError: true, message: `pnpm failed (exit ${code}): ${stderr || stdout}` };
    },
  ],

  // tsc (TypeScript compiler): 0 = success, non-zero = errors found
  [
    "tsc",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      return {
        isError: true,
        message: `TypeScript compilation errors found (${code} errors). Check output for details.`,
      };
    },
  ],

  // curl: 0 = success, non-zero varies by error type
  [
    "curl",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      
      const errorMessages: Record<number, string> = {
        6: "Could not resolve host - check domain or network",
        7: "Connection refused - server may be down",
        28: "Operation timeout - server too slow",
        35: "SSL/TLS error - certificate issues",
        52: "Empty response - server sent no data",
        60: "SSL certificate verification failed",
      };
      
      return {
        isError: true,
        message: errorMessages[code] || `curl error (exit ${code}): ${stderr || stdout}`,
      };
    },
  ],

  // Default handler for unknown commands
  [
    "default",
    (code, stdout, stderr) => {
      if (code === 0) return { isError: false };
      return {
        isError: true,
        message: `Command failed with exit code ${code}: ${stderr || stdout}`,
      };
    },
  ],
]);

/**
 * Get the semantic handler for a command
 * Falls back to default semantics if specific handler not found
 */
export function getCommandSemantics(command: string): CommandSemantic {
  // Extract base command name from complex commands like "git log" -> "git"
  const baseCommand = command.split(/\s+/)[0];
  return COMMAND_SEMANTICS.get(baseCommand) || COMMAND_SEMANTICS.get("default")!;
}

/**
 * Interpret exit code using appropriate semantics
 */
export function interpretExitCode(
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): ExitCodeSemantics {
  const semantic = getCommandSemantics(command);
  return semantic(exitCode, stdout, stderr);
}
