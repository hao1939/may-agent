import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAgentScoreSummary } from "../src/evaluator.js";

function tmpDir(): string {
  const dir = join(tmpdir(), `eval-task-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("getAgentScoreSummary", () => {
  it("returns empty object when evaluations dir does not exist", () => {
    const dir = tmpDir();
    const result = getAgentScoreSummary(dir);
    expect(result).toEqual({});
  });

  it("groups by agent and computes correct averages", () => {
    const dir = tmpDir();
    const evalsDir = join(dir, "evaluations");
    mkdirSync(evalsDir, { recursive: true });

    writeFileSync(
      join(evalsDir, "session-1.json"),
      JSON.stringify({
        agent: "coder",
        sessionId: "session-1",
        efficiency: 8,
        quality: 9,
        verdict: "good",
      }),
    );

    writeFileSync(
      join(evalsDir, "session-2.json"),
      JSON.stringify({
        agent: "coder",
        sessionId: "session-2",
        efficiency: 6,
        quality: 7,
        verdict: "acceptable",
      }),
    );

    writeFileSync(
      join(evalsDir, "session-3.json"),
      JSON.stringify({
        agent: "qa",
        sessionId: "session-3",
        efficiency: 9,
        quality: 10,
        verdict: "good",
      }),
    );

    // No agent field — should be skipped
    writeFileSync(join(evalsDir, "session-4.json"), JSON.stringify({}));

    const result = getAgentScoreSummary(dir);

    expect(Object.keys(result).sort()).toEqual(["coder", "qa"]);

    expect(result.coder).toEqual({
      avgEfficiency: 7,
      avgQuality: 8,
      count: 2,
      verdicts: { good: 1, acceptable: 1 },
      trend: "declining",
    });

    expect(result.qa).toEqual({
      avgEfficiency: 9,
      avgQuality: 10,
      count: 1,
      verdicts: { good: 1 },
      trend: "stable",
    });
  });

  it("skips files with invalid JSON", () => {
    const dir = tmpDir();
    const evalsDir = join(dir, "evaluations");
    mkdirSync(evalsDir, { recursive: true });

    writeFileSync(join(evalsDir, "bad.json"), "not valid json{{{");
    writeFileSync(
      join(evalsDir, "good.json"),
      JSON.stringify({ agent: "coder", efficiency: 5, quality: 5, verdict: "ok" }),
    );

    const result = getAgentScoreSummary(dir);
    expect(Object.keys(result)).toEqual(["coder"]);
    expect(result.coder.count).toBe(1);
  });

  it("treats missing efficiency/quality as 0 and missing verdict as 'unknown'", () => {
    const dir = tmpDir();
    const evalsDir = join(dir, "evaluations");
    mkdirSync(evalsDir, { recursive: true });

    writeFileSync(join(evalsDir, "minimal.json"), JSON.stringify({ agent: "bot" }));

    const result = getAgentScoreSummary(dir);
    expect(result.bot).toEqual({
      avgEfficiency: 0,
      avgQuality: 0,
      count: 1,
      verdicts: { unknown: 1 },
      trend: "stable",
    });
  });

  it("returns stable trend with only 1 evaluation", () => {
    const dir = tmpDir();
    const evalsDir = join(dir, "evaluations");
    mkdirSync(evalsDir, { recursive: true });

    writeFileSync(
      join(evalsDir, "2024-01-01T00-00-00.json"),
      JSON.stringify({
        agent: "solo",
        efficiency: 5,
        quality: 5,
        verdict: "acceptable",
      }),
    );

    const result = getAgentScoreSummary(dir);
    expect(result.solo.trend).toBe("stable");
  });

  it("returns improving trend when second half efficiency is higher", () => {
    const dir = tmpDir();
    const evalsDir = join(dir, "evaluations");
    mkdirSync(evalsDir, { recursive: true });

    writeFileSync(
      join(evalsDir, "2024-01-01T00-00-00.json"),
      JSON.stringify({
        agent: "learner",
        efficiency: 4,
        quality: 5,
        verdict: "needs_improvement",
      }),
    );

    writeFileSync(
      join(evalsDir, "2024-06-01T00-00-00.json"),
      JSON.stringify({
        agent: "learner",
        efficiency: 8,
        quality: 9,
        verdict: "good",
      }),
    );

    const result = getAgentScoreSummary(dir);
    expect(result.learner.trend).toBe("improving");
  });
});
