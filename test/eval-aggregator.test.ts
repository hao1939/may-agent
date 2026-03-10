import { describe, it, expect } from 'vitest';
import { computeAgentSummary, findCoachingTargets, type EvalRecord } from '../src/lib/eval-aggregator';

function makeEval(overrides: Partial<EvalRecord> & { sessionId: string }): EvalRecord {
  return {
    agent: 'test-agent',
    quality: 0.5,
    efficiency: 0.5,
    verdict: 'acceptable',
    issues: [],
    usage: { inputTokens: 1000, outputTokens: 100, cost: 0.01, turns: 5 },
    ...overrides,
  };
}

describe('computeAgentSummary', () => {
  it('returns zeroed summary for empty evals', () => {
    const result = computeAgentSummary([]);
    expect(result.totalSessions).toBe(0);
    expect(result.meanQuality).toBe(0);
    expect(result.recentTrend).toBe('stable');
  });

  it('computes mean quality correctly', () => {
    const evals = [
      makeEval({ sessionId: 's_1_0', quality: 0.8 }),
      makeEval({ sessionId: 's_2_0', quality: 0.6 }),
      makeEval({ sessionId: 's_3_0', quality: 0.4 }),
    ];
    const result = computeAgentSummary(evals);
    expect(result.meanQuality).toBeCloseTo(0.6, 5);
  });

  it('detects improving trend when sorted chronologically', () => {
    // Sessions in chronological order by sessionId
    const evals = [
      makeEval({ sessionId: 's_100_0', quality: 0.2 }),
      makeEval({ sessionId: 's_200_0', quality: 0.3 }),
      makeEval({ sessionId: 's_300_0', quality: 0.25 }),
      makeEval({ sessionId: 's_400_0', quality: 0.7 }),
      makeEval({ sessionId: 's_500_0', quality: 0.8 }),
      makeEval({ sessionId: 's_600_0', quality: 0.9 }),
    ];
    const result = computeAgentSummary(evals);
    // Early mean: (0.2 + 0.3 + 0.25) / 3 = 0.25
    // Recent mean: (0.7 + 0.8 + 0.9) / 3 = 0.8
    // Should be "improving"
    expect(result.recentTrend).toBe('improving');
  });

  it('trend is correct even when evals arrive out of order', () => {
    // Same data as above but shuffled — simulates filesystem listing order
    const evals = [
      makeEval({ sessionId: 's_500_0', quality: 0.8 }),
      makeEval({ sessionId: 's_100_0', quality: 0.2 }),
      makeEval({ sessionId: 's_600_0', quality: 0.9 }),
      makeEval({ sessionId: 's_300_0', quality: 0.25 }),
      makeEval({ sessionId: 's_200_0', quality: 0.3 }),
      makeEval({ sessionId: 's_400_0', quality: 0.7 }),
    ];
    const result = computeAgentSummary(evals);
    // After sorting by sessionId: early = [0.2, 0.3, 0.25] mean=0.25, recent = [0.7, 0.8, 0.9] mean=0.8
    // Correctly shows "improving"
    expect(result.recentTrend).toBe('improving');
  });

  it('aggregates issue counts by type', () => {
    const evals = [
      makeEval({ sessionId: 's_1_0', issues: ['[WASTED_CALL] read config.ts unnecessarily'] }),
      makeEval({ sessionId: 's_2_0', issues: ['[WASTED_CALL] read package.json unnecessarily'] }),
      makeEval({ sessionId: 's_3_0', issues: ['[SCOPE_DRIFT] edited unrelated file'] }),
    ];
    const result = computeAgentSummary(evals);
    // Issues are grouped by type: [WASTED_CALL] (count 2) and [SCOPE_DRIFT] (count 1)
    expect(result.topIssues).toHaveLength(2);
    expect(result.topIssues[0]).toBe('[WASTED_CALL]');
    expect(result.topIssues[1]).toBe('[SCOPE_DRIFT]');
  });

  it('computes total cost', () => {
    const evals = [
      makeEval({ sessionId: 's_1_0', usage: { inputTokens: 1000, outputTokens: 100, cost: 0.50, turns: 5 } }),
      makeEval({ sessionId: 's_2_0', usage: { inputTokens: 2000, outputTokens: 200, cost: 1.25, turns: 8 } }),
    ];
    const result = computeAgentSummary(evals);
    expect(result.totalCost).toBeCloseTo(1.75, 5);
  });
});

describe('findCoachingTargets', () => {
  it('returns agents below quality threshold', () => {
    const evals = [
      makeEval({ agent: 'good-agent', sessionId: 's_1_0', quality: 0.9 }),
      makeEval({ agent: 'good-agent', sessionId: 's_2_0', quality: 0.85 }),
      makeEval({ agent: 'bad-agent', sessionId: 's_3_0', quality: 0.3 }),
      makeEval({ agent: 'bad-agent', sessionId: 's_4_0', quality: 0.2 }),
    ];
    const targets = findCoachingTargets(evals, 0.5);
    expect(targets).toHaveLength(1);
    expect(targets[0].agent).toBe('bad-agent');
  });

  it('sorts targets by quality (worst first)', () => {
    const evals = [
      makeEval({ agent: 'medium', sessionId: 's_1_0', quality: 0.4 }),
      makeEval({ agent: 'worst', sessionId: 's_2_0', quality: 0.1 }),
      makeEval({ agent: 'bad', sessionId: 's_3_0', quality: 0.3 }),
    ];
    const targets = findCoachingTargets(evals, 0.5);
    expect(targets.map((t) => t.agent)).toEqual(['worst', 'bad', 'medium']);
  });
});
