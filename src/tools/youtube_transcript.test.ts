import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { youtube_transcript_definition, youtube_transcript_handler } from "./youtube_transcript.js";
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

describe("youtube_transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(youtube_transcript_definition.function.name).toBe("youtube_transcript");
    expect(youtube_transcript_definition.function.parameters.required).toContain("url");
  });

  it("rejects invalid YouTube URLs", async () => {
    const result = await youtube_transcript_handler({ url: "https://google.com" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Invalid YouTube URL");
  });

  it("reports missing yt-dlp", async () => {
    mockExecFile.mockImplementation(execFileErr());
    const result = await youtube_transcript_handler({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("yt-dlp is not installed");
  });

  it("handles yt-dlp dump-json failure", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) {
        (cb as Function)(null, "2024.01.01\n", "");
      } else {
        (cb as Function)(new Error("yt-dlp failed"), "", "");
      }
      return undefined;
    }) as typeof execFile);

    const result = await youtube_transcript_handler({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("yt-dlp error");
  });

  it("extracts video ID from youtu.be URL", async () => {
    let call = 0;
    mockExecFile.mockImplementation(((cmd: string, args: string[], opts: any, cb: Function) => {
      if (typeof opts === "function") { cb = opts; }
      call++;
      if (call === 1) {
        (cb as Function)(null, "2024.01.01\n", "");
      } else {
        (cb as Function)(new Error("test error"), "", "");
      }
      return undefined;
    }) as typeof execFile);

    const result = await youtube_transcript_handler({ url: "https://youtu.be/dQw4w9WgXcQ" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("yt-dlp error");
  });
});
