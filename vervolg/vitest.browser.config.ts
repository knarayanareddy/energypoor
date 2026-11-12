import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Browser-measured acceptance (A1/A2/A3/A4/A11).
 *
 * Separate from `npm test` on purpose: it needs a running dev server and a
 * Chromium, and it takes ~60 s. `npm run test:browser` with `npm run dev` up.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src"), "@data": path.resolve(__dirname, "./data") },
  },
  test: {
    environment: "node",
    include: ["src/test-browser/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 240000,
    hookTimeout: 240000,
  },
});
