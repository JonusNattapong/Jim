import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { office_definition, office_handler } from "./office.js";
import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

function execFileOk(stdout: string) {
  return ((cmd: string, args: string[], opts: any, cb: Function) => {
    if (typeof opts === "function") { cb = opts; }
    (cb as Function)(null, stdout, "");
    return undefined;
  }) as typeof execFile;
}

function execFileErr(msg: string) {
  return ((cmd: string, args: string[], opts: any, cb: Function) => {
    if (typeof opts === "function") { cb = opts; }
    (cb as Function)(new Error(msg), "", "");
    return undefined;
  }) as typeof execFile;
}

describe("office", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(office_definition.function.name).toBe("office");
    expect(office_definition.function.parameters.required).toContain("command");
    expect(office_definition.function.parameters.required).toContain("file");
  });

  it("reports missing officecli", async () => {
    mockExecFile.mockImplementation(execFileErr("not found"));
    const result = await office_handler({ command: "create", file: "test.docx" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("OfficeCLI is not installed");
  });

  it("rejects non-office files", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "create", file: "test.pdf" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("File must be .docx, .xlsx, or .pptx");
  });

  it("runs create command", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) (cb as Function)(null, "1.0.0\n", "");
      else (cb as Function)(null, "Created: test.pptx\n", "");
      return undefined;
    }) as typeof execFile);

    const result = await office_handler({ command: "create", file: "test.pptx" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Created");
  });

  it("requires path for get command", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "get", file: "test.pptx" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("'path' is required");
  });

  it("requires path for set command", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "set", file: "test.pptx" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("'path' is required");
  });

  it("requires props for set command", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "set", file: "test.pptx", path: "/slide[1]" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("'props' is required");
  });

  it("runs set with props", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) (cb as Function)(null, "1.0.0\n", "");
      else (cb as Function)(null, '{"success":true}', "");
      return undefined;
    }) as typeof execFile);

    const result = await office_handler({
      command: "set",
      file: "test.pptx",
      path: "/slide[1]/shape[1]",
      props: "text=Hello",
    });
    expect(result.isError).toBeFalsy();
  });

  it("requires type for add command", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "add", file: "test.pptx", path: "/" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("'type' is required");
  });

  it("accepts xlsx files", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) (cb as Function)(null, "1.0.0\n", "");
      else (cb as Function)(null, "Created: budget.xlsx\n", "");
      return undefined;
    }) as typeof execFile);

    const result = await office_handler({ command: "create", file: "budget.xlsx" });
    expect(result.isError).toBeFalsy();
  });

  it("handles validate command", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) (cb as Function)(null, "1.0.0\n", "");
      else (cb as Function)(null, '{"valid":true}', "");
      return undefined;
    }) as typeof execFile);

    const result = await office_handler({ command: "validate", file: "report.docx" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("valid");
  });

  it("handles unknown command", async () => {
    mockExecFile.mockImplementation(execFileOk("1.0.0\n"));
    const result = await office_handler({ command: "explode", file: "test.pptx" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Unknown command");
  });
});
