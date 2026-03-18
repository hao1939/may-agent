import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Gym scenario environment files are standalone scripts, not Vitest tests.
      // They use process.exit() and their own test runners.
      "test/gym/scenarios/**/environment/**",
    ],
  },
});
