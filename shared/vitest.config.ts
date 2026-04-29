import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    root: resolve(__dirname, ".."),
    include: ["shared/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "shared/workflows/**/*.ts",
        "shared/lib/**/*.ts",
        "shared/guards/**/*.ts",
        "shared/evaluation/**/*.ts",
      ],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
