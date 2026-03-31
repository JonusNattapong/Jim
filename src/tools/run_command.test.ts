import { describe, it, expect } from "vitest";

describe("run_command_handler", () => {
  it("executes simple command successfully", async () => {
    const { run_command_handler } = await import("./run_command.js");

    const result = await run_command_handler({ command: "echo hello" });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("hello");
  });

  it("returns error for blocked command", async () => {
    const { run_command_handler } = await import("./run_command.js");

    const result = await run_command_handler({ command: "rm -rf /" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("BLOCKED");
  });

  it("handles command that exits with non-zero code", async () => {
    const { run_command_handler } = await import("./run_command.js");

    const result = await run_command_handler({ command: "exit 1" });

    expect(result.isError).toBe(true);
  });

  it("produces output from multi-line command", async () => {
    const { run_command_handler } = await import("./run_command.js");

    const result = await run_command_handler({ command: "echo line1 && echo line2 && echo line3" });

    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("line1");
    expect(result.content).toContain("line2");
    expect(result.content).toContain("line3");
  });
});
