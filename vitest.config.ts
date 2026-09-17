import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The pure layer is where correctness lives, so it is the only thing measured.
    coverage: {
      include: ["lib/**/*.ts"],
      exclude: ["lib/db/**"],
    },
  },
});
