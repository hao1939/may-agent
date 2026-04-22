import { describe, it, expect, afterEach } from "vitest";
import { getAgentScoreSummary } from "../evaluator.js";
import type { EvalCtx } from "../evaluator.js";

// ── In-memory EvalCtx for testing ────────────────────────────────────

interface StoredEval {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string[];
  createdAt: number;
}

function createMockCtx(): EvalCtx & { _store: Map<string, StoredEval> } {
  const store = new Map<string, StoredEval>();
  return {
    _store: store,
    readSessionMessages: () => [],
    readArchivedSessionMessages: () => [],
    upsertEvaluation: (opts: any) => {
      store.set(opts.sessionId, {
        sessionId: opts.sessionId,
        agent: opts.agent,
        quality: opts.quality ?? 0,
        efficiency: opts.efficiency ?? 0,
        productiveCalls: opts.productiveCalls ?? 0,
        wastedCalls: opts.wastedCalls ?? 0,
        verdict: opts.verdict ?? "needs_improvement",
        issues: opts.issues ?? [],
        createdAt: opts.createdAt ?? Date.now(),
      });
    },
    hasEvaluation: (sessionId: string) => store.has(sessionId),
    hasLLMEvaluation: (sessionId: string) => store.has(sessionId),
    getAllEvaluations: () => [...store.values()].sort((a, b) => a.createdAt - b.createdAt),
  };
}

describe("getAgentScoreSummary", () => {
  it("returns empty object when no evaluations exist", () => {
    const ctx = createMockCtx();
    const result = getAgentScoreSummary(ctx);
    expect(result).toEqual({});
  });

  it("groups by agent and computes correct averages", () => {
    const ctx = createMockCtx();

    ctx.upsertEvaluation({
      sessionId: "session-1", agent: "coder", efficiency: 8, quality: 9, verdict: "good", createdAt: 1000,
    });
    ctx.upsertEvaluation({
      sessionId: "session-2", agent: "coder", efficiency: 6, quality: 7, verdict: "acceptable", createdAt: 2000,
    });
    ctx.upsertEvaluation({
      sessionId: "session-3", agent: "qa", efficiency: 9, quality: 10, verdict: "good", createdAt: 3000,
    });

    const result = getAgentScoreSummary(ctx);

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
    const ctx = createMockCtx();

    ctx.upsertEvaluation({
      sessionId: "no-agent", agent: "", efficiency: 5, quality: 5, verdict: "ok", createdAt: 1000,
    });
    ctx.upsertEvaluation({
      sessionId: "good-one", agent: "coder", efficiency: 5, quality: 5, verdict: "ok", createdAt: 2000,
    });

    const result = getAgentScoreSummary(ctx);
    expect(Object.keys(result)).toEqual(["coder"]);
    expect(result.coder.count).toBe(1);
  });

  it("treats zero efficiency/quality and unknown verdict correctly", () => {
    const ctx = createMockCtx();

    ctx.upsertEvaluation({
      sessionId: "minimal", agent: "bot", quality: 0, efficiency: 0, verdict: "unknown", createdAt: 1000,
    });

    const result = getAgentScoreSummary(ctx);
    expect(result.bot).toEqual({
      avgEfficiency: 0,
      avgQuality: 0,
      count: 1,
      verdicts: { unknown: 1 },
      trend: "stable",
    });
  });

  it("returns stable trend with only 1 evaluation", () => {
    const ctx = createMockCtx();

    ctx.upsertEvaluation({
      sessionId: "solo-session", agent: "solo", efficiency: 5, quality: 5, verdict: "acceptable", createdAt: 1000,
    });

    const result = getAgentScoreSummary(ctx);
    expect(result.solo.trend).toBe("stable");
  });

  it("returns improving trend when second half efficiency is higher", () => {
    const ctx = createMockCtx();

    ctx.upsertEvaluation({
      sessionId: "early-session", agent: "learner", efficiency: 4, quality: 5, verdict: "needs_improvement", createdAt: 1000,
    });
    ctx.upsertEvaluation({
      sessionId: "late-session", agent: "learner", efficiency: 8, quality: 9, verdict: "good", createdAt: 2000,
    });

    const result = getAgentScoreSummary(ctx);
    expect(result.learner.trend).toBe("improving");
  });
});
