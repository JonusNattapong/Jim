import { describe, it, expect } from "vitest";
import { StreamingToolExecutor } from "./streaming-executor.js";

describe("StreamingToolExecutor", () => {
  it("streams start/complete and aborts siblings on siblingAbort", async () => {
    const ex = new StreamingToolExecutor({ maxConcurrent: 2, timeoutMs: 5000, maxRetries: 0 });

    const updates: any[] = [];

    const handler1 = async (_args: any) => {
      // completes quickly and requests sibling abort
      await new Promise((r) => setTimeout(r, 100));
      return { content: "ok", siblingAbort: true } as any;
    };

    const handler2 = async (args: any) => {
      const sig = args.__abortSignal as AbortSignal | undefined;
      return await new Promise((resolve) => {
        const t = setTimeout(() => resolve({ content: "done" }), 1000);
        if (sig) {
          sig.addEventListener("abort", () => {
            clearTimeout(t);
            resolve({ content: "aborted", isError: true });
          }, { once: true });
        }
      });
    };
    // start tools first so internal update queue is populated, then start consumer
    const p1 = ex.executeTool("a", handler1, {} as any);
    const p2 = ex.executeTool("b", handler2, {} as any);

    // small delay to let executor push initial updates
    await new Promise((r) => setTimeout(r, 10));

    const consumer = (async () => {
      for await (const u of ex.getRemainingResults()) {
        updates.push(u);
      }
    })();

    const [r1, r2] = await Promise.all([p1, p2]);

    // allow generator to flush
    await new Promise((r) => setTimeout(r, 50));

    expect(r1.result.content).toBe("ok");
    // handler2 should have been aborted due to siblingAbort
    expect(r2.result.isError).toBeTruthy();

    expect(updates.some(u => u.type === "start" && u.toolName === "a")).toBeTruthy();
    expect(updates.some(u => u.type === "start" && u.toolName === "b")).toBeTruthy();
    expect(updates.some(u => u.type === "complete" && u.toolName === "a")).toBeTruthy();

    // b may be reported as a 'complete' with an error result or as an 'error' event,
    // accept either form.
    const bErrorReported = updates.some(u => (u.type === "error" && u.toolName === "b")
      || (u.type === "complete" && u.toolName === "b" && u.result?.result?.isError));
    expect(bErrorReported).toBeTruthy();

    // ensure consumer finished
    await consumer;
  });
});
