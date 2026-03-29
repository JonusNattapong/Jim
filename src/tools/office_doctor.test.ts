import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { office_doctor_definition, office_doctor_handler } from "./office_doctor.js";
import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

function execFileOk(stdout: string) {
  return ((cmd: string, args: string[], opts: any, cb: Function) => {
    if (typeof opts === "function") { cb = opts; }
    (cb as Function)(null, stdout, "");
    return undefined;
  }) as typeof execFile;
}

function execFileErr() {
  return ((cmd: string, args: string[], opts: any, cb: Function) => {
    if (typeof opts === "function") { cb = opts; }
    (cb as Function)(new Error("not found"), "", "");
    return undefined;
  }) as typeof execFile;
}

describe("office_doctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(office_doctor_definition.function.name).toBe("office_doctor");
  });

  it("reports missing officecli", async () => {
    mockExecFile.mockImplementation(execFileErr());
    const result = await office_doctor_handler({});
    expect(result.content).toContain("OfficeCLI Doctor");
    expect(result.content).toContain("not installed");
  });

  it("reports installed officecli with capabilities", async () => {
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      if (args[0] === "--version") {
        (cb as Function)(null, "1.0.25\n", "");
      } else if (args[0] === "mcp") {
        (cb as Function)(null, "claude: registered\n", "");
      } else {
        (cb as Function)(null, "help output\n", "");
      }
      return undefined;
    }) as typeof execFile);

    const result = await office_doctor_handler({});
    expect(result.content).toContain("OfficeCLI Doctor");
    expect(result.content).toContain("1.0.25");
    expect(result.content).toContain("Word (.docx)");
    expect(result.content).toContain("Excel (.xlsx)");
    expect(result.content).toContain("PowerPoint (.pptx)");
  });
});
