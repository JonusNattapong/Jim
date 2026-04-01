/**
 * Tool Validation Module
 * Centralized validation logic for tool arguments and execution safety
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

export interface CommandValidationRules {
  dangerous?: RegExp[];
  dangerous_patterns?: string[];
  safe_patterns?: RegExp[];
  requiresApproval?: boolean;
}

/**
 * Dangerous command patterns that should require approval
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /^(rm|del)\s+-rf|--recursive/, // Recursive delete
  /mkfs|format|fdisk|parted/, // Filesystem operations
  /sudo\s+(rm|del|mkfs)/, // Sudo dangerous ops
  /:\(\)\s*\{\s*:\s*\|\s*:\s*;\s*\}/, // Fork bombs ():{ :| :; }
  /chmod\s+-R\s+777/, // Wide permissions
  /drop\s+database|truncate\s+table/i, // Database destruction
];

/**
 * Safe command patterns that are generally okay
 */
const SAFE_PATTERNS: RegExp[] = [
  /^npm\s+(install|ci|test|build|run)/, // NPM safe commands
  /^pnpm\s+(install|test|build|run)/, // pnpm commands
  /^yarn\s+(install|add|test|build)/, // Yarn commands
  /^git\s+(clone|pull|push|commit|add)/, // Git safe commands
  /^ls|^pwd|^cat|^echo/, // Simple file operations
];

/**
 * Validate a shell command for dangerous patterns
 */
export function validateCommand(command: string): ValidationResult {
  // Check against dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        valid: false,
        error: `Command matches dangerous pattern: ${pattern.source}`,
        suggestion: "This command could harm the system or data. Request explicit user approval before running.",
      };
    }
  }

  // Check for empty/malformed commands
  if (!command.trim()) {
    return {
      valid: false,
      error: "Command cannot be empty",
    };
  }

  // Passes validation
  return { valid: true };
}

/**
 * Check if a command requires user approval
 */
export function requiresApproval(command: string): boolean {
  // Commands that modify system state typically require approval
  const modifyingOps = [
    /^(rm|del)/,
    /mkfs|format|dd\s+if=|dd\s+of=/,
    /chmod|chown/,
    /^npm\s+install|^npm\s+uninstall/,
    /package\.json/,
    /git\s+push/,
    /^sudo/,
  ];

  return modifyingOps.some((pattern) => pattern.test(command));
}

/**
 * Validate file path for safety
 */
export function validateFilePath(
  filePath: string,
  options?: {
    mustExist?: boolean;
    maxSize?: number;
    allowedDirs?: string[];
  },
): ValidationResult {
  // Allow relative paths with .. at the start (going up from project root)
  // But prevent path traversal in the middle like "src/../../../etc/passwd"
  if (filePath.includes("../") && !filePath.startsWith("../")) {
    return {
      valid: false,
      error: "Path traversal detected",
      suggestion: "Use relative paths within the project. Avoid ../ in the middle of paths.",
    };
  }

  // Prevent absolute paths outside project (optional)
  // Allow Windows UNC paths for network shares starting with \\
  if ((filePath.startsWith("/") || /^[a-z]:/i.test(filePath)) && 
      !filePath.startsWith("\\\\")) {
    return {
      valid: false,
      error: "Absolute paths are not allowed. Use relative paths from project root.",
      suggestion: "Use paths like 'src/file.ts' instead of '/home/user/project/src/file.ts'",
    };
  }

  return { valid: true };
}

/**
 * Validate regex pattern for syntax errors
 */
export function validateRegexPattern(pattern: string): ValidationResult {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Invalid regex: ${message}`,
      suggestion: "Check your pattern for unescaped special characters or unclosed groups. Test at regex101.com",
    };
  }
}

/**
 * Validate tool argument types
 */
export function validateArguments(
  args: Record<string, any>,
  schema: Record<string, { type: string; required?: boolean }>,
): ValidationResult {
  for (const [key, spec] of Object.entries(schema)) {
    const value = args[key];

    if (spec.required && value === undefined) {
      return {
        valid: false,
        error: `Missing required argument: ${key}`,
      };
    }

    if (value !== undefined) {
      const actualType = typeof value;
      const expectedType = spec.type.toLowerCase();

      if (actualType !== expectedType) {
        return {
          valid: false,
          error: `Argument ${key} has wrong type. Expected ${expectedType}, got ${actualType}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Sanitize command for logging (remove secrets)
 */
export function sanitizeCommandForLogging(command: string): string {
  // Remove common secret patterns
  return command
    .replace(/--api-key[=\s]+\S+/gi, "--api-key=***")
    .replace(/--token[=\s]+\S+/gi, "--token=***")
    .replace(/--password[=\s]+\S+/gi, "--password=***")
    .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer ***")
    .replace(/npm_token=\S+/gi, "npm_token=***");
}
