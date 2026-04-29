import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/workflows/**/*.ts", "shared/lib/**/*.ts", "shared/guards/**/*.ts"],
      thresholds: {
        lines: 40,
      },
    },
  },
});
