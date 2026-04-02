# EXP-006 Phase 1 Results: Information Regime Analysis

**Status**: Complete
**Date**: 2026-04-01
**Tests**: H-013 (Hub-Leaf Performance Gap = Information Regime Effect)
**Analyst**: Bob (Architect)

## Summary

**H-013 is NOT SUPPORTED by observational data.** The predicted correlation between shared-memory input proportion and session quality does not exist. The hub-leaf performance gap is real, but it's not explained by information regime as measured by file access patterns.

## Methodology

Analyzed 1,065 evaluated sessions (last 7 days) with session transcripts. For each session:
1. Extracted all tool calls from `session.jsonl`
2. Classified file reads by type (shared vs own vs other-agent)
3. Computed multiple metrics: shared proportion, unique directories, DB queries, info scatter, input complexity
4. Correlated each metric with evaluation quality score and verdict

## Key Results

### 1. No Correlation Between Information Regime and Quality

| Metric | Overall r | Within-Agent r |
|--------|-----------|----------------|
| sharedProportion | 0.03 | -0.07 |
| uniqueReadDirs | -0.02 | -0.07 |
| infoScatter | -0.14 | -0.13 |
| inputComplexity | 0.10 | -0.05 |
| dbQueries | 0.12 | -0.01 |
| totalReads | 0.07 | 0.01 |
| bashCalls | -0.07 | -0.15 |
| totalToolCalls | -0.01 | -0.07 |

**H-013 predicted r > 0.3 between sequential-input proportion and quality. Actual: r ≈ 0.** The prediction fails both overall and within-agent.

### 2. Good Rates Are Flat Across Information Complexity

| Complexity | N | Good% | NI/Poor% |
|-----------|---|-------|----------|
| Simple (0-2 dirs) | 587 | 86.5% | 1.4% |
| Moderate (3-5 dirs) | 198 | 83.8% | 3.5% |
| Complex (6+ dirs) | 280 | 83.2% | 1.1% |

No meaningful trend. If anything, complex sessions have *fewer* NI/poor outcomes.

### 3. Agent Performance Gaps Remain Unexplained

| Agent | N | AvgReads | AvgDirs | DB Queries | Shared% | Quality | Good% |
|-------|---|----------|---------|------------|---------|---------|-------|
| scout | 62 | 5.2 | 1.7 | 0.0 | 2% | 4.82 | 94% |
| qa | 164 | 3.1 | 1.8 | 0.0 | 0% | 4.07 | 93% |
| amy-kimi | 53 | 7.3 | 3.5 | 0.0 | 31% | 4.02 | 89% |
| may | 179 | 0.8 | 0.3 | 0.8 | 2% | 4.72 | 88% |
| bob | 148 | 12.8 | 5.5 | 9.0 | 27% | 4.64 | 86% |
| optimizer | 166 | 7.7 | 2.0 | 5.5 | 2% | 4.38 | 86% |
| tech-lead | 59 | 5.2 | 2.1 | 0.8 | 4% | 3.92 | 85% |
| coder | 30 | 4.3 | 1.1 | 0.0 | 0% | 0.76 | 83% |
| coach | 197 | 5.8 | 2.8 | 0.8 | 7% | 3.56 | 72% |

**Notable**: Bob reads the most (12.8 avg) from the most directories (5.5) with the most DB queries (9.0) and 27% shared files — yet scores 86% good. Scout reads few files (5.2) from few places (1.7) and scores 94%. But the info-diet difference is not the causal factor — the within-agent correlation is near zero.

### 4. Shared-Memory Quartile Analysis (sessions with file reads only)

| Quartile | Shared% Range | N | Good% | NI/Poor% |
|----------|---------------|---|-------|----------|
| Q1 (least shared) | 0.00-0.00 | 212 | 79.2% | 1.4% |
| Q2 | 0.00-0.00 | 212 | 88.2% | 2.8% |
| Q3 | 0.00-0.15 | 212 | 90.1% | 0.9% |
| Q4 (most shared) | 0.15-1.00 | 215 | 84.7% | 1.4% |

**The lowest shared-file quartile has the WORST good rate (79.2%).** This is opposite to H-013's prediction.

## Why H-013 Failed

Several possible explanations:

### 1. File Access ≠ Information Regime
The hypothesis was about *information quality* (stale, ambiguous, fragmented) vs (fresh, clear, specific). But file access patterns are a poor proxy. A session that reads 10 files might be doing focused sequential work (reading a codebase), while a session that reads 2 files might be doing complex synthesis (reading SIGNALS.md then making judgment calls).

### 2. Task Difficulty Confound
Hub agents may genuinely have harder tasks. "Route this request" (may) is simpler than "decide what behavioral intervention to apply" (coach), regardless of information sources.

### 3. Evaluator Bias
Evaluators may apply different standards to different task types. A scout session that finds 3 papers is "good." A coach session that runs one experiment with ambiguous results might be "acceptable" even if executed well.

### 4. Model Capacity Confound
All agents use the same model. The model may simply be better at some task types (research, code review) than others (behavioral analysis, architectural decision-making). This would produce agent-level performance gaps unrelated to information flow.

### 5. The Regime May Be in the TASK, Not the FILES
DD#481's "sequential" vs "shared" refers to task structure (predecessor outputs vs shared memory), not file access patterns. Our sessions don't have predecessor-successor relationships in the same way — each session starts fresh with its own prompt.

## Updated Understanding

The hub-leaf performance gap is real but not caused by information regime as a file-access pattern. More likely explanations:
- **Task inherent difficulty**: coordination decisions are harder than artifact production
- **Evaluation artifact bias**: clear artifacts (code, report) are easier to evaluate as "good" than judgment calls
- **Model capability distribution**: the underlying model may be better at some agent roles

## Recommendation

H-013 should be marked as "**weakly refuted (Phase 1)**" — the specific mechanism proposed (shared-memory file access pattern) doesn't correlate with quality. The broader insight that "information quality matters" may still be true but needs a different operationalization.

Do NOT proceed to Phase 2 (interventional). The correlational prerequisite is not met.

## Next Steps

1. Investigate task-difficulty confound: classify tasks by inherent difficulty (independent of agent) and see if that explains the gap
2. Investigate evaluator bias: compare eval criteria across agents
3. Consider H-014: "Hub-leaf gap is a task-type ceiling effect" — some task types have lower maximum achievable quality regardless of information structure

## Files

- `agents/bob/workspace/exp-006-phase1.js` — Initial analysis script (crude classification)
- `agents/bob/workspace/exp-006-phase1b.js` — Revised analysis script (multiple metrics)
- `agents/shared/knowledge/experiments/EXP-006/results.md` — This file
