import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["workflows/**/*.ts"],
      thresholds: {
        lines: 30,
      },
    },
  },
});
