import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["test/**/*.test.ts"],
    exclude: ["gym/**", "node_modules/**", "shared/projects/outputs/**"],
    coverage: {
      provider: "v8",
      include: ["shared/workflows/**/*.ts", "shared/lib/**/*.ts", "shared/guards/**/*.ts"],
      exclude: [
        "shared/workflows/project.ts",
        "shared/workflows/implement-and-verify.ts",
        "shared/guards/loader.ts",
      ],
      thresholds: {
        lines: 60,
      },
    },
  },
});
