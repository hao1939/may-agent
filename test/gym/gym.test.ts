/**
 * Gym runner integration tests.
 * Tests the infrastructure (listing, filtering, JSON output structure).
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve, join } from "path";

const PROJECT_ROOT = resolve(join(__dirname, "../../.."));
const RUN_GYM = join(PROJECT_ROOT, "scripts/gym-run.sh");

function gym(args: string): string {
  return execSync(`bash ${RUN_GYM} ${args}`, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env, GYM_PROJECT_ROOT: PROJECT_ROOT, GYM_NO_RECORD: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function gymAllowFail(args: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = gym(args);
    return { stdout, stderr: "", status: 0 };
  } catch (err: unknown) {
    const execErr = Object(err);
    return {
      stdout: (execErr.stdout ?? "").toString(),
      stderr: (execErr.stderr ?? "").toString(),
      status: execErr.status ?? 1,
    };
  }
}

describe("gym runner --list", () => {
  it("lists all scenarios", () => {
    const out = gym("--list");
    const lines = out.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(40);
    // Each line starts with scenario name, followed by tier= and categories=
    for (const line of lines.slice(0, 5)) {
      expect(line).toContain("tier=");
    }
  });

  it("lists smoke scenarios", () => {
    const out = gym("--list --tier smoke");
    const lines = out.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.some(l => l.startsWith("phantom-fix"))).toBe(true);
    // All should be smoke tier
    for (const line of lines) {
      expect(line).toContain("tier=smoke");
    }
  });

  it("filters by tier (standard includes smoke)", () => {
    const smoke = gym("--list --tier smoke").trim().split("\n").filter(Boolean);
    const standard = gym("--list --tier standard").trim().split("\n").filter(Boolean);
    expect(standard.length).toBeGreaterThan(smoke.length);
    // All smoke scenarios should be in standard
    for (const s of smoke) {
      const name = s.trim().split(/\s+/)[0];
      expect(standard.some(l => l.trim().startsWith(name!))).toBe(true);
    }
  });

  it("filters by tag", () => {
    const out = gym("--list --tag ability");
    const lines = out.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("filters by category", () => {
    const out = gym("--list --category bug-fixing");
    const lines = out.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some(l => l.startsWith("phantom-fix"))).toBe(true);
  });

  it("includes known scenarios", () => {
    const out = gym("--list");
    const known = ["phantom-fix", "cascading-error", "hasty-fix", "bloated-refactor"];
    for (const name of known) {
      expect(out).toContain(name);
    }
  });
});

describe("gym runner single scenario", () => {
  it("returns error for nonexistent scenario", () => {
    const { stdout, status } = gymAllowFail("nonexistent-scenario-xyz");
    expect(status).not.toBe(0);
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const result = JSON.parse(jsonMatch![0]);
    expect(result.passed).toBe(false);
    expect(result.scenario).toBe("nonexistent-scenario-xyz");
    expect(result.summary).toContain("not found");
  });
});
