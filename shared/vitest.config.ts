import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      thresholds: {
        lines: 30,
      },
    },
  },
});
