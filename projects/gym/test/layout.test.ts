import { describe, expect, it } from "bun:test";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const allowedEntries = new Set([
  ".state",
  "README.md",
  "archive",
  "benchmarks",
  "bun.lock",
  "dist",
  "docs",
  "node_modules",
  "package.json",
  "scenarios",
  "schemas",
  "src",
  "test",
  "tsconfig.json",
]);

describe("Gym project layout", () => {
  it("contains only normalized top-level entries", () => {
    const unexpected = readdirSync(root)
      .filter((entry) => !allowedEntries.has(entry))
      .sort();

    expect(unexpected).toEqual([]);
  });

  it("owns source, tests, documentation, and generated scoring output", () => {
    for (const entry of ["src", "test", "docs", "dist", "scenarios", "benchmarks"]) {
      expect(lstatSync(resolve(root, entry)).isDirectory()).toBe(true);
    }
    expect(lstatSync(resolve(root, "dist/@may-agent/gym/scoring.js")).isFile()).toBe(true);
    expect(lstatSync(resolve(root, "bun.lock")).isFile()).toBe(true);
    expect(lstatSync(resolve(root, "src/scenarios")).isDirectory()).toBe(true);
  });

  it("does not restore ambiguous generated or temporary top-level folders", () => {
    expect(existsSync(resolve(root, "lib"))).toBe(false);
    expect(existsSync(resolve(root, "experiments"))).toBe(false);
  });
});
