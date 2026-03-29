import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "src/test/**"],
    testTimeout: 15000,
    hookTimeout: 10000,
    maxWorkers: 4,
    environment: "node",
  },
});
