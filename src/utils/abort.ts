export function createAbortController(timeoutMs?: number): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  if (timeoutMs) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  const cleanup = () => { if (timer) clearTimeout(timer); };
  return { controller, cleanup };
}

export function mergeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) { controller.abort(); break; }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label?: string): Promise<T> {
  const { controller, cleanup } = createAbortController(timeoutMs);
  const timeoutPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("Timeout: " + (label || "operation"))));
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    cleanup();
  }
}
