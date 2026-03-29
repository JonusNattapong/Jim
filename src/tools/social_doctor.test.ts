import { describe, it, expect, vi, beforeEach } from "vitest";
import { social_doctor_definition, social_doctor_handler } from "./social_doctor.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("social_doctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(social_doctor_definition.function.name).toBe("social_doctor");
  });

  it("reports diagnostic results", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((cmd: string, args: string[], cb: Function) => {
      if (args.includes("--version")) {
        (cb as Function)(null, "version\n", "");
      } else {
        (cb as Function)(new Error("not found"), "", "");
      }
      return undefined;
    }) as typeof execFile);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Example Domain\nThis is an example."),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await social_doctor_handler({});
    expect(result.content).toContain("Social Doctor");
    expect(result.content).toContain("ok");
  });

  it("reports missing tools as off", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((cmd: string, args: string[], cb: Function) => {
      (cb as Function)(new Error("not found"), "", "");
      return undefined;
    }) as typeof execFile);

    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await social_doctor_handler({});
    expect(result.content).toContain("Social Doctor");
    expect(result.content).toContain("off");
  });
});
