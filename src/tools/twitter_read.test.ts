import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { twitter_read_definition, twitter_read_handler } from "./twitter_read.js";
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
    (cb as Function)(new Error(msg), "", msg);
    return undefined;
  }) as typeof execFile;
}

describe("twitter_read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(twitter_read_definition.function.name).toBe("twitter_read");
    expect(twitter_read_definition.function.parameters.required).toContain("url");
  });

  it("rejects invalid Twitter URLs", async () => {
    mockExecFile.mockImplementation(execFileErr("not found"));
    const result = await twitter_read_handler({ url: "https://google.com" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Invalid Twitter/X URL");
  });

  it("reports missing bird CLI", async () => {
    mockExecFile.mockImplementation(execFileErr("not found"));
    const result = await twitter_read_handler({ url: "https://twitter.com/user/status/1234567890" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("bird CLI is not installed");
  });

  it("handles successful read", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) {
        (cb as Function)(null, "1.0.0\n", "");
      } else {
        (cb as Function)(null, "@user: This is a tweet content with 100 likes", "");
      }
      return undefined;
    }) as typeof execFile);

    const result = await twitter_read_handler({ url: "https://x.com/user/status/1234567890" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("tweet");
  });

  it("handles auth errors gracefully", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) {
        (cb as Function)(null, "1.0.0\n", "");
      } else {
        (cb as Function)(new Error("Missing credentials"), "", "Missing credentials");
      }
      return undefined;
    }) as typeof execFile);

    const result = await twitter_read_handler({ url: "https://x.com/user/status/1234567890" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("authentication");
  });
});
