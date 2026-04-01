import { describe, it, expect } from "vitest";

import { getToolPrompt, buildToolPromptsSection } from "../prompts/index.js";
import { interpretExitCode, getCommandSemantics } from "../semantics/index.js";
import { validateCommand, requiresApproval, validateRegexPattern } from "../validation/index.js";
import { TOOL_ERRORS, getToolError, formatErrorWithSuggestion } from "../errors/index.js";

describe("Tool Enhancement System", () => {
  describe("Prompts", () => {
    it("should get prompt for grep", () => {
      const prompt = getToolPrompt("grep");
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe("grep");
      expect(prompt?.systemPrompt).toContain("ripgrep");
    });

    it("should build all tool prompts section", () => {
      const section = buildToolPromptsSection();
      expect(section).toContain("Tool Usage Guidelines");
      expect(section).toContain("run_command");
      expect(section).toContain("grep");
    });

    it("should return undefined for unknown tool", () => {
      const prompt = getToolPrompt("unknown_tool");
      expect(prompt).toBeUndefined();
    });
  });

  describe("Command Semantics", () => {
    it("should interpret grep exit code 1 as no matches", () => {
      const result = interpretExitCode("grep", 1, "", "");
      expect(result.isError).toBe(false);
      expect(result.message).toContain("No matches");
    });

    it("should interpret grep exit code 2 as error", () => {
      const result = interpretExitCode("grep", 2, "", "permission denied");
      expect(result.isError).toBe(true);
    });

    it("should interpret ripgrep correctly", () => {
      const semantic = getCommandSemantics("rg");
      expect(semantic).toBeDefined();

      const noMatch = semantic(1, "", "");
      expect(noMatch.isError).toBe(false);

      const error = semantic(2, "", "error message");
      expect(error.isError).toBe(true);
    });

    it("should interpret find exit codes", () => {
      const semantic = getCommandSemantics("find");

      // Code 0 = success
      const success = semantic(0, "", "");
      expect(success.isError).toBe(false);

      // Code 1 = partial success
      const partial = semantic(1, "", "");
      expect(partial.isError).toBe(false);
      expect(partial.message).toContain("permission");

      // Code 2 = error
      const error = semantic(2, "", "error");
      expect(error.isError).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should reject dangerous commands", () => {
      const result = validateCommand("rm -rf /");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous pattern");
    });

    it("should reject mkfs (filesystem operations)", () => {
      const result = validateCommand("mkfs.ext4 /dev/sda");
      expect(result.valid).toBe(false);
    });

    it("should allow safe commands", () => {
      const result = validateCommand("npm install");
      expect(result.valid).toBe(true);
    });

    it("should reject empty commands", () => {
      const result = validateCommand("");
      expect(result.valid).toBe(false);
    });

    it("should detect commands requiring approval", () => {
      expect(requiresApproval("rm file.txt")).toBe(true);
      expect(requiresApproval("npm install")).toBe(true);
      expect(requiresApproval("git push")).toBe(true);
      expect(requiresApproval("ls -la")).toBe(false);
    });

    it("should validate regex patterns", () => {
      const valid = validateRegexPattern("\\d+");
      expect(valid.valid).toBe(true);

      const invalid = validateRegexPattern("[invalid(");
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain("Invalid regex");
    });
  });

  describe("Error Catalogue", () => {
    it("should get FILE_NOT_FOUND error", () => {
      const error = getToolError("FILE_NOT_FOUND");
      expect(error).toBeDefined();
      expect(error?.code).toBe("FILE_NOT_FOUND");
      expect(error?.suggestion).toContain("grep");
    });

    it("should format error with suggestion", () => {
      const error = TOOL_ERRORS.FILE_NOT_FOUND;
      const formatted = formatErrorWithSuggestion(error);
      expect(formatted).toContain(error.title);
      expect(formatted).toContain("💡");
    });

    it("should have all required error fields", () => {
      for (const error of Object.values(TOOL_ERRORS)) {
        expect(error.code).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.suggestion).toBeDefined();
      }
    });
  });
});
