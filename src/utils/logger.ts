import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const destination = pino.destination({ dest: ".jim.log", sync: true });

export const logger = pino({
  level,
  name: "jim",
}, destination);

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

export async function shutdownLogger(): Promise<void> {
  destination.flushSync?.();
  if (typeof destination.end === "function") {
    destination.end();
  }
}
