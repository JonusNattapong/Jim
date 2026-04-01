/**
 * Centralized Error Catalogue
 * Tool-specific error messages with actionable suggestions
 */

export interface ToolError {
  code: string;
  title: string;
  message: string;
  suggestion: string;
  examples?: string[];
}

export const TOOL_ERRORS = {
  // File operation errors
  FILE_NOT_FOUND: {
    code: "FILE_NOT_FOUND",
    title: "File or directory not found",
    message: "The specified file or directory does not exist",
    suggestion:
      "Use grep or list_files to find the correct path. Remember paths are relative to the project root.",
    examples: ["Use grep_search to find definitions", "Use list_files to explore directory structure"],
  } as ToolError,

  FILE_PERMISSION_DENIED: {
    code: "FILE_PERMISSION_DENIED",
    title: "Permission denied",
    message: "No permission to read or write the file",
    suggestion:
      "Check file permissions. On macOS/Linux use 'chmod' to fix. On Windows use 'icacls'.",
  } as ToolError,

  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    title: "File read truncated",
    message: "File exceeded output size limit (usually 5000 chars)",
    suggestion:
      "Use grep to search for specific content instead of reading the entire file. Or use list_files with filters.",
  } as ToolError,

  // Command errors
  COMMAND_TIMEOUT: {
    code: "COMMAND_TIMEOUT",
    title: "Command execution timeout",
    message: "Command took too long to execute (usually >30s)",
    suggestion: "Try breaking the command into smaller steps, or increase timeout parameter if needed.",
  } as ToolError,

  COMMAND_NOT_FOUND: {
    code: "COMMAND_NOT_FOUND",
    title: "Command not found",
    message: "The command does not exist or is not installed",
    suggestion: "Try installing the required tool. Use run_command to check: 'which <command>'",
    examples: ["which npm", "which python", "which git"],
  } as ToolError,

  COMMAND_FAILED: {
    code: "COMMAND_FAILED",
    title: "Command execution failed",
    message: "Command exited with error status",
    suggestion: "Check stderr output for details. Try running the command manually to debug.",
  } as ToolError,

  NO_MATCHES_FOUND: {
    code: "NO_MATCHES_FOUND",
    title: "Search returned no results",
    message: "The grep/rg search pattern found no matches",
    suggestion:
      "Try different search terms, check the pattern syntax, or verify the file even exists in that location.",
  } as ToolError,

  // Git errors
  NOT_A_REPOSITORY: {
    code: "NOT_A_REPOSITORY",
    title: "Not a git repository",
    message: "Current directory is not a git repository",
    suggestion:
      "Make sure you're in the correct project directory. Use get_repo_map to find the project root.",
  } as ToolError,

  GIT_MERGE_CONFLICT: {
    code: "GIT_MERGE_CONFLICT",
    title: "Git merge conflict",
    message: "Merge or rebase resulted in conflicts",
    suggestion:
      "Manually resolve conflicts in the files marked with <<<<<<< ======== >>>>>>>. Then run 'git add' and 'git commit'.",
  } as ToolError,

  // Permissions/Security errors
  PERMISSION_DENIED: {
    code: "PERMISSION_DENIED",
    title: "Operation not allowed",
    message: "The tool requires user approval before proceeding",
    suggestion:
      "This is a safety measure. Use ask_user_choice to get explicit approval, then retry the operation.",
  } as ToolError,

  DANGEROUS_COMMAND: {
    code: "DANGEROUS_COMMAND",
    title: "Dangerous command detected",
    message: "The command could harm the system or data",
    suggestion:
      "This command requires explicit approval. Always ask the user before running rm, mkfs, or system-critical commands.",
  } as ToolError,

  // Web/Network errors
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    title: "Network request failed",
    message: "Could not reach the remote server",
    suggestion: "Check your internet connection. Try again later. Some APIs may be rate-limited.",
  } as ToolError,

  RATE_LIMITED: {
    code: "RATE_LIMITED",
    title: "API rate limit exceeded",
    message: "Too many requests to the API",
    suggestion: "Wait before retrying. Consider caching results or batching requests.",
  } as ToolError,

  // Parse/Validation errors
  INVALID_JSON: {
    code: "INVALID_JSON",
    title: "Invalid JSON format",
    message: "Failed to parse JSON data",
    suggestion:
      "Check for syntax errors: missing quotes, trailing commas, unescaped characters. Use a JSON validator.",
  } as ToolError,

  INVALID_REGEX: {
    code: "INVALID_REGEX",
    title: "Invalid regex pattern",
    message: "The regex pattern has a syntax error",
    suggestion:
      "Test your regex at regex101.com or similar. Common issues: unescaped special chars, unclosed groups.",
  } as ToolError,

  INVALID_REGEX_PATTERN: {
    code: "INVALID_REGEX_PATTERN",
    title: "Invalid regex pattern",
    message: "The regex pattern has a syntax error",
    suggestion:
      "Test your regex at regex101.com or similar. Common issues: unescaped special chars, unclosed groups.",
  } as ToolError,

  INVALID_FILE_PATH: {
    code: "INVALID_FILE_PATH",
    title: "Invalid file path",
    message: "The file path is invalid or not allowed",
    suggestion:
      "Use relative paths within the project root. Avoid absolute paths or path traversal sequences like ../ in the middle.",
  } as ToolError,

  COMMAND_VALIDATION_FAILED: {
    code: "COMMAND_VALIDATION_FAILED",
    title: "Command validation failed",
    message: "The command failed safety checks",
    suggestion:
      "The command matches a dangerous pattern. If you need to run this, add additional safety checks or ask for user approval.",
  } as ToolError,

  // Tool-specific errors
  NO_ACTIVE_SESSION: {
    code: "NO_ACTIVE_SESSION",
    title: "No active session",
    message: "No user session is currently active",
    suggestion: "Start a new session or restore an existing one.",
  } as ToolError,

  INVALID_TOOL_ARGS: {
    code: "INVALID_TOOL_ARGS",
    title: "Invalid tool arguments",
    message: "The tool received invalid or missing arguments",
    suggestion: "Check the tool definition and ensure all required parameters are provided with correct types.",
  } as ToolError,

  // Edit/Write errors
  EDIT_MATCH_NOT_FOUND: {
    code: "EDIT_MATCH_NOT_FOUND",
    title: "Edit pattern not found",
    message: "The exact text to replace could not be found in the file",
    suggestion:
      "Make sure the text matches exactly including whitespace and indentation. Use read_file to verify, or grep to find the exact location.",
    examples: ["read_file path='src/file.ts' start_line=10 end_line=20", "grep pattern='exact.*text'"],
  } as ToolError,

  EDIT_CONTEXT_MISMATCH: {
    code: "EDIT_CONTEXT_MISMATCH",
    title: "Edit context mismatch",
    message: "The surrounding context doesn't match. The file may have been modified.",
    suggestion:
      "Read the file again to get fresh content and proper context. Make sure you include 3-5 lines before and after the change.",
  } as ToolError,

  WRITE_PERMISSION_DENIED: {
    code: "WRITE_PERMISSION_DENIED",
    title: "Can't write to file",
    message: "No write permission for the target file or directory",
    suggestion: "Check file permissions. If it's in node_modules or a build directory, it may be read-only. Try a different location.",
  } as ToolError,

  FILE_ALREADY_EXISTS: {
    code: "FILE_ALREADY_EXISTS",
    title: "File already exists",
    message: "Cannot create file because it already exists",
    suggestion:
      "If you want to overwrite, use edit_file instead of write_file. Or delete the file first with run_command.",
  } as ToolError,

  // Git-specific errors
  GIT_UNCOMMITTED_CHANGES: {
    code: "GIT_UNCOMMITTED_CHANGES",
    title: "Uncommitted changes",
    message: "Working directory has uncommitted changes",
    suggestion:
      "Commit or stash your changes first. Use: 'git status' to see what's changed, then 'git add' and 'git commit'.",
  } as ToolError,

  GIT_DIRTY_WORKING_TREE: {
    code: "GIT_DIRTY_WORKING_TREE",
    title: "Git working tree is dirty",
    message: "Cannot perform operation due to uncommitted changes",
    suggestion:
      "Commit, stash, or discard changes first. Use 'git stash' to temporarily save work, or 'git restore' to discard.",
  } as ToolError,

  GIT_NO_REMOTE: {
    code: "GIT_NO_REMOTE",
    title: "No remote repository configured",
    message: "Cannot push/pull without a remote",
    suggestion:
      "Add a remote with: 'git remote add origin <url>'. Or use 'git branch --set-upstream-to=<remote>/<branch>' for local branches.",
  } as ToolError,

  GIT_AUTHENTICATION_FAILED: {
    code: "GIT_AUTHENTICATION_FAILED",
    title: "Git authentication failed",
    message: "Could not authenticate with remote (wrong credentials or SSH key)",
    suggestion:
      "Check your SSH key setup or GitHub token. Use 'ssh -T git@github.com' to test SSH, or 'git credential-manager' for HTTPS.",
  } as ToolError,

  GIT_BRANCH_DIVERGED: {
    code: "GIT_BRANCH_DIVERGED",
    title: "Branch has diverged",
    message: "Local branch has diverged from remote",
    suggestion:
      "Use 'git pull --rebase' to rebase onto remote, or 'git merge' to create a merge commit. Be careful with force push.",
  } as ToolError,

  // Web/API errors
  INVALID_URL: {
    code: "INVALID_URL",
    title: "Invalid URL",
    message: "The URL format is invalid or unreachable",
    suggestion: "Check the URL syntax. Common issues: missing 'http://' protocol, typos in domain.",
  } as ToolError,

  HTTP_ERROR_4XX: {
    code: "HTTP_ERROR_4XX",
    title: "HTTP client error (4xx)",
    message: "Request was malformed or unauthorized",
    suggestion:
      "Check if the URL exists, if auth is needed (headers, API key), or if the resource was deleted (404).",
  } as ToolError,

  HTTP_ERROR_5XX: {
    code: "HTTP_ERROR_5XX",
    title: "HTTP server error (5xx)",
    message: "Remote server returned an error",
    suggestion: "The server may be down or busy. Try again later or contact the API provider.",
  } as ToolError,

  // Code/Parsing errors
  SYNTAX_ERROR: {
    code: "SYNTAX_ERROR",
    title: "Syntax error in code",
    message: "Code has syntax errors that prevent parsing",
    suggestion:
      "Use ts_check to find the exact location. Common issues: missing semicolons, unmatched brackets, wrong indentation.",
  } as ToolError,

  TYPE_ERROR: {
    code: "TYPE_ERROR",
    title: "Type mismatch",
    message: "Variable has wrong type",
    suggestion:
      "Use ts_check in hover mode to see the expected type. Use ts_check mode='project' before and after edits to catch type issues.",
  } as ToolError,

  IMPORT_NOT_FOUND: {
    code: "IMPORT_NOT_FOUND",
    title: "Import not found",
    message: "The imported module or symbol doesn't exist",
    suggestion:
      "Check the import path spelling and that the module is installed. Use ts_check hover mode to verify the export name.",
  } as ToolError,

  // Test/Build errors
  TEST_FAILURE: {
    code: "TEST_FAILURE",
    title: "Test failed",
    message: "One or more tests did not pass",
    suggestion:
      "Use 'npm test -- --reporter=verbose' to see details. Then use grep or read_file to examine the test and code.",
  } as ToolError,

  BUILD_FAILURE: {
    code: "BUILD_FAILURE",
    title: "Build failed",
    message: "Project build failed to complete",
    suggestion:
      "Check build output for error messages. Use ts_check to find TypeScript issues, or run the build tool directly for more details.",
  } as ToolError,

  DEPENDENCY_NOT_FOUND: {
    code: "DEPENDENCY_NOT_FOUND",
    title: "Dependency not installed",
    message: "Required package is not installed",
    suggestion:
      "Install missing dependencies with 'npm install' or 'pnpm install'. Check package.json to ensure the dep is listed.",
  } as ToolError,

  // Browser/Automation errors
  BROWSER_CRASH: {
    code: "BROWSER_CRASH",
    title: "Browser crashed",
    message: "Browser instance unexpectedly terminated",
    suggestion: "Try restarting the browser action or checking available system resources (memory/CPU).",
  } as ToolError,

  BROWSER_TIMEOUT: {
    code: "BROWSER_TIMEOUT",
    title: "Browser action timeout",
    message: "Browser operation took too long",
    suggestion: "Page may be slow or the element may not exist. Try increasing timeout or checking page state first.",
  } as ToolError,

  ELEMENT_NOT_FOUND: {
    code: "ELEMENT_NOT_FOUND",
    title: "Element not found on page",
    message: "Could not locate the element",
    suggestion:
      "Use browser_action extract to see page structure. Check if element is loaded dynamically, hidden, or requires scrolling.",
  } as ToolError,
};

/**
 * Get error details by code
 */
export function getToolError(errorCode: string): ToolError | undefined {
  return Object.values(TOOL_ERRORS).find((err) => err.code === errorCode);
}

/**
 * Format error with suggestion for user
 */
export function formatErrorWithSuggestion(error: ToolError): string {
  let result = `**${error.title}** (${error.code})\n${error.message}\n\n💡 ${error.suggestion}`;

  if (error.examples && error.examples.length > 0) {
    result += `\n\nExamples:\n${error.examples.map((ex) => `- ${ex}`).join("\n")}`;
  }

  return result;
}
