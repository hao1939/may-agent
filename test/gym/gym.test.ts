/**
 * Gym runner integration tests.
 * Tests the infrastructure (listing, filtering, JSON output structure).
 * Uses stub mode (no real agent binary needed).
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve, join } from "path";

const AGENTS_ROOT = resolve(join(__dirname, "../.."));
const PROJECT_ROOT = resolve(join(AGENTS_ROOT, ".."));
const RUN_GYM = join(AGENTS_ROOT, "test/gym/run-gym.sh");

function gym(args: string): string {
  return execSync(`bash ${RUN_GYM} ${args}`, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env, GYM_PROJECT_ROOT: PROJECT_ROOT },
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
    // Each line has name\ttier\tcategories format
    for (const line of lines.slice(0, 5)) {
      expect(line.split("\t").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("lists smoke scenarios", () => {
    const out = gym("--list --tier smoke");
    const lines = out.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.some(l => l.startsWith("phantom-fix"))).toBe(true);
    // All should be smoke tier
    for (const line of lines) {
      expect(line).toContain("smoke");
    }
  });

  it("filters by tier (standard includes smoke)", () => {
    const smoke = gym("--list --tier smoke").trim().split("\n").filter(Boolean);
    const standard = gym("--list --tier standard").trim().split("\n").filter(Boolean);
    expect(standard.length).toBeGreaterThan(smoke.length);
    // All smoke scenarios should appear in standard list
    const standardNames = standard.map(l => l.split("\t")[0]);
    for (const s of smoke) {
      const name = s.split("\t")[0];
      expect(standardNames).toContain(name);
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
  it("produces valid GymResult JSON for phantom-fix (stub mode)", () => {
    const { stdout } = gymAllowFail("phantom-fix --agent amy --timeout 2");
    const result = JSON.parse(stdout);

    // Verify GymResult structure
    expect(result).toHaveProperty("scenario", "phantom-fix");
    expect(result).toHaveProperty("agent", "amy");
    expect(result).toHaveProperty("lab_fork");
    expect(typeof result.passed).toBe("boolean");
    expect(Array.isArray(result.checks)).toBe(true);
    expect(typeof result.summary).toBe("string");
    expect(result).toHaveProperty("agent_status");
    expect(typeof result.duration).toBe("string");
    expect(result).toHaveProperty("gym_root");
  });

  it("checks array has name/passed fields", () => {
    const { stdout } = gymAllowFail("phantom-fix --agent coder --timeout 2");
    const result = JSON.parse(stdout);

    for (const check of result.checks) {
      expect(check).toHaveProperty("name");
      expect(typeof check.name).toBe("string");
      expect(typeof check.passed).toBe("boolean");
    }
  });

  it("returns error for nonexistent scenario", () => {
    const { stdout, status } = gymAllowFail("nonexistent-scenario-xyz");
    expect(status).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.passed).toBe(false);
    expect(result.scenario).toBe("nonexistent-scenario-xyz");
    expect(result.summary).toContain("not found");
  });

  it("success_criteria.js is invoked against work dir", () => {
    const { stdout } = gymAllowFail("phantom-fix --agent amy --timeout 2");
    const result = JSON.parse(stdout);
    // phantom-fix criteria checks for specific things — should have multiple checks
    expect(result.checks.length).toBeGreaterThan(0);
    // At least one check should have a name containing a meaningful identifier
    const checkNames = result.checks.map((c: any) => c.name);
    expect(checkNames.some((n: string) => n.length > 3)).toBe(true);
  });
});
