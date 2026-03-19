import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAgentScoreSummary } from "../src/lib/evaluator.js";
import { upsertEvaluation, closeDb } from "../src/lib/requests.js";

const dirs: string[] = [];

function tmpDir(): string {
  const dir = join(tmpdir(), `eval-task-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs) {
    try { closeDb(d); } catch { /* ignore */ }
  }
  dirs.length = 0;
});

describe("getAgentScoreSummary", () => {
  it("returns empty object when evaluations dir does not exist", () => {
    const dir = tmpDir();
    const result = getAgentScoreSummary(dir);
    expect(result).toEqual({});
  });

  it("groups by agent and computes correct averages", () => {
    const dir = tmpDir();

    upsertEvaluation(dir, {
      sessionId: "session-1",
      agent: "coder",
      efficiency: 8,
      quality: 9,
      verdict: "good",
      createdAt: 1000,
    });

    upsertEvaluation(dir, {
      sessionId: "session-2",
      agent: "coder",
      efficiency: 6,
      quality: 7,
      verdict: "acceptable",
      createdAt: 2000,
    });

    upsertEvaluation(dir, {
      sessionId: "session-3",
      agent: "qa",
      efficiency: 9,
      quality: 10,
      verdict: "good",
      createdAt: 3000,
    });

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

  it("skips evals with no agent field", () => {
    const dir = tmpDir();

    // Eval with empty agent should be skipped by getAgentScoreSummary
    upsertEvaluation(dir, {
      sessionId: "no-agent",
      agent: "",
      efficiency: 5,
      quality: 5,
      verdict: "ok",
      createdAt: 1000,
    });

    upsertEvaluation(dir, {
      sessionId: "good-one",
      agent: "coder",
      efficiency: 5,
      quality: 5,
      verdict: "ok",
      createdAt: 2000,
    });

    const result = getAgentScoreSummary(dir);
    expect(Object.keys(result)).toEqual(["coder"]);
    expect(result.coder.count).toBe(1);
  });

  it("treats zero efficiency/quality and unknown verdict correctly", () => {
    const dir = tmpDir();

    upsertEvaluation(dir, {
      sessionId: "minimal",
      agent: "bot",
      quality: 0,
      efficiency: 0,
      verdict: "unknown",
      createdAt: 1000,
    });

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

    upsertEvaluation(dir, {
      sessionId: "solo-session",
      agent: "solo",
      efficiency: 5,
      quality: 5,
      verdict: "acceptable",
      createdAt: 1000,
    });

    const result = getAgentScoreSummary(dir);
    expect(result.solo.trend).toBe("stable");
  });

  it("returns improving trend when second half efficiency is higher", () => {
    const dir = tmpDir();

    upsertEvaluation(dir, {
      sessionId: "early-session",
      agent: "learner",
      efficiency: 4,
      quality: 5,
      verdict: "needs_improvement",
      createdAt: 1000,
    });

    upsertEvaluation(dir, {
      sessionId: "late-session",
      agent: "learner",
      efficiency: 8,
      quality: 9,
      verdict: "good",
      createdAt: 2000,
    });

    const result = getAgentScoreSummary(dir);
    expect(result.learner.trend).toBe("improving");
  });
});
