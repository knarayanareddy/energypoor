import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@data": path.resolve(__dirname, "./data"),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts"],
    // the chain tests write to logs/audit.jsonl; keep them in one process so
    // the store's module-level mutex is real
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30000,
  },
});
