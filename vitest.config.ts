import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

/**
 * Vite plugin that stubs `bun:sqlite` for vitest (which runs under Node).
 * The real bun:sqlite is a Bun built-in unavailable in Node.  Tests that
 * transitively import it (e.g. coach workflow discovery → gym-helpers.ts)
 * get a no-op Database class so the import resolves without error.
 */
function bunSqliteStub(): Plugin {
  const virtualId = "\0bun-sqlite-stub";
  return {
    name: "bun-sqlite-stub",
    enforce: "pre",
    resolveId(id) {
      if (id === "bun:sqlite") return virtualId;
    },
    load(id) {
      if (id === virtualId) {
        return `export class Database { constructor() {} query() { return { get() {}, all() { return []; }, run() {} }; } exec() {} run() {} close() {} transaction(fn) { return fn; } }`;
      }
    },
  };
}

export default defineConfig({
  plugins: [bunSqliteStub()],
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
    maxWorkers: 4,
    minWorkers: 1,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Bun package cache contains third-party test files (e.g. zod tests)
      ".state/**",
      // Gym scenario environment files are standalone scripts, not vitest tests
      "agents/gym/scenarios/**/environment/**",
      // bun:test files (incompatible with vitest — run via `bun test src/lib/`)
      "src/lib/__tests__/**",
      // Agent-generated test files with missing dependencies
      "agents/shared/projects/outputs/**",
      "agents/shared/tests/**",
    ],
  },
});
