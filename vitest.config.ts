import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Gym scenario environment files are standalone scripts, not vitest tests
      "agents/gym/scenarios/**/environment/**",
    ],
  },
});
