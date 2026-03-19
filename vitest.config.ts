import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Gym scenarios live in agents/gym/scenarios/ (gitignored, not scanned).
    ],
  },
});
