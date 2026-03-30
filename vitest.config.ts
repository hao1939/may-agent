import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Bun package cache contains third-party test files (e.g. zod tests)
      ".state/**",
      // Gym scenario environment files are standalone scripts, not vitest tests
      "agents/gym/scenarios/**/environment/**",
    ],
  },
});
