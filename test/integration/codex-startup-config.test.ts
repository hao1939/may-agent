import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("Codex startup configuration", () => {
  test("uses the supported setting to disable startup update checks", () => {
    const source = readFileSync(resolve(repoRoot, "container/setup-codex-config.sh"), "utf8");

    expect(source).toContain("check_for_update_on_startup = false");
    expect(source).toContain('export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"');
    expect(source).not.toContain("CODEX_BASE_URL");
    expect(source).not.toMatch(/^update_on_startup\s*=/m);
  });
});
