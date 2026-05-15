import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@may-agent/sdk/testing": resolve(__dirname, "projects/may-agent/packages/sdk/src/testing.ts"),
      "@may-agent/sdk": resolve(__dirname, "projects/may-agent/packages/sdk/src/index.ts"),
    },
  },
  test: {
    root: ".",
    include: [
      "test/**/*.test.ts",
      "shared/**/*.test.ts",
      "agents/**/*.test.ts",
    ],
    exclude: [
      "gym/**",
      "node_modules/**",
      "**/node_modules/**",
      "shared/projects/**",
      "agents/shared/**",
      "projects/**",
      ".state/**",
      "shared/tests/context-learn*.test.ts",
      "shared/tests/evaluator.test.ts",
      "shared/tests/evaluator-extended.test.ts",
      "shared/tests/evaluator-deep.test.ts",
      "test/heartbeat-data.test.ts",
      "test/gym/**",
      "test/dispatch-validator.test.ts",
      "test/eval-llm-scan-smoke.test.ts",
    ],
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
