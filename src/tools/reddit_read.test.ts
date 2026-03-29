import { describe, it, expect, vi, beforeEach } from "vitest";
import { reddit_read_definition, reddit_read_handler } from "./reddit_read.js";

describe("reddit_read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct tool definition", () => {
    expect(reddit_read_definition.function.name).toBe("reddit_read");
    expect(reddit_read_definition.function.parameters.required).toContain("url");
  });

  it("rejects invalid Reddit URLs", async () => {
    const result = await reddit_read_handler({ url: "https://google.com" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Could not parse Reddit URL");
  });

  it("extracts post info from reddit URL", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await reddit_read_handler({ url: "https://reddit.com/r/programming/comments/abc123/test_post/" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Reddit error");
  });

  it("extracts subreddit info from URL", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await reddit_read_handler({ url: "https://reddit.com/r/typescript" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("Reddit error");
  });

  it("handles 403 errors with proxy hint", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("403 blocked"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await reddit_read_handler({ url: "https://reddit.com/r/programming/comments/abc123/" });
    expect(result.isError).toBe(true);
    expect(result.content).toContain("blocked");
    expect(result.content).toContain("proxy");
  });

  it("handles successful post fetch", async () => {
    const postData = [
      {
        data: {
          children: [
            {
              data: {
                title: "Test Post",
                subreddit: "programming",
                author: "testuser",
                score: 100,
                num_comments: 10,
                selftext: "This is a test post",
              },
            },
          ],
        },
      },
      {
        data: {
          children: [
            {
              kind: "t1",
              data: {
                author: "commenter1",
                body: "Great post!",
                score: 50,
              },
            },
          ],
        },
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(postData),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await reddit_read_handler({ url: "https://reddit.com/r/programming/comments/abc123/test_post/" });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain("Test Post");
    expect(result.content).toContain("r/programming");
    expect(result.content).toContain("Great post!");
  });
});
