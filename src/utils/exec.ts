import { execFile } from "node:child_process";

export const execFileAsync = (file: string, args: string[] = [], options: any = {}) => {
  const isWin = process.platform === "win32";
  const opts = { shell: isWin, encoding: "utf-8", ...options };

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(file, args, opts, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      }
    });

    // Support cooperative cancellation via AbortSignal in options.signal
    const signal: AbortSignal | undefined = options?.signal ?? options?.__abortSignal;
    if (signal) {
      const onAbort = () => {
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      };

      if (signal.aborted) {
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      } else {
        signal.addEventListener("abort", onAbort, { once: true });

        const cleanup = () => {
          try { signal.removeEventListener("abort", onAbort); } catch { /* ignore */ }
        };

        child.on("close", cleanup);
        child.on("error", cleanup);
      }
    }
  });
};
