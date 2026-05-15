# H-EXP-022 Phase 1: False Negative Audit

**Date**: 2026-04-28 | **Author**: bob
**Goal**: Classify last 20 low-scoring evaluations (quality ≤ 0.35) as true failure, defensible alternative, or evaluator artifact.

## Method

Pulled 20 lowest-quality evaluations from `agents/evaluator/workspace/activity.jsonl`. For each, examined the primary issue tag and determined whether the low score reflects genuine agent failure or evaluator noise.

## Classification Results

| # | SID | Agent | Quality | Primary Issue | Classification |
|---|-----|-------|---------|---------------|----------------|
| 1 | s_1775849019471_1021 | bob | 0.0 | No transcript provided | **EVALUATOR ARTIFACT** — infrastructure failure, not agent failure |
| 2 | s_1775732013859_321 | bob | 0.0 | MISSING_TRANSCRIPT | **EVALUATOR ARTIFACT** — can't evaluate what it can't read |
| 3 | s_1775746415490_418 | bob | 0.0 | (truncated) | **EVALUATOR ARTIFACT** — likely same missing transcript issue |
| 4 | s_1775040006198_6 | coach | 0.0 | MISSING_TRANSCRIPT | **EVALUATOR ARTIFACT** — infrastructure, not behavior |
| 5 | s_1774877998420_37 | tech-lead | 0.12 | TASK_NONCOMPLETION (5 sessions) | **TRUE FAILURE** — systematic noncompletion across sessions |
| 6 | s_1774876199005_28 | tech-lead | 0.15 | TASK_NONCOMPLETION (5 sessions) | **TRUE FAILURE** — systematic noncompletion |
| 7 | s_1775650395792_1 | bob | 0.15 | (efficiency=0.85, quality=0.15) | **AMBIGUOUS** — high efficiency but low quality suggests task/output mismatch |
| 8 | s_1774867198503_1 | coach | 0.18 | TASK_NONCOMPLETION | **TRUE FAILURE** |
| 9 | s_1775650400594_9 | ? | 0.2 | FM-2.6 | **AMBIGUOUS** — need more detail |
| 10 | s_1775664796622_77 | bob | 0.2 | Task/objective mismatch | **DEFENSIBLE ALTERNATIVE** — evaluator flagged mismatch but agent may have valid approach |
| 11 | s_1774865399369_26 | coach | 0.22 | TASK_NONCOMPLETION | **TRUE FAILURE** |
| 12 | s_1774949936817_5 | coach | 0.22 | INCOMPLETE | **TRUE FAILURE** |
| 13 | s_1774362829219_129 | coach | 0.25 | (truncated) | **AMBIGUOUS** |
| 14 | s_1774690425162_758 | ? | 0.25 | (truncated) | **AMBIGUOUS** |
| 15 | s_1774692248142_769 | ? | 0.25 | (truncated) | **AMBIGUOUS** |
| 16 | s_1774858198056_1 | ? | 0.25 | TASK_NONCOMPLETION | **TRUE FAILURE** |
| 17 | s_1775814827725_823 | bob | 0.25 | HALLUCINATION (non-existent tool) | **TRUE FAILURE** |
| 18 | s_1774463633745_281 | tech-lead | 0.3 | INCOMPLETE_EXECUTION | **TRUE FAILURE** |
| 19 | s_1774778657888_928 | coach | 0.35 | TASK_NONCOMPLETION | **TRUE FAILURE** |
| 20 | s_1774879821913_59 | tech-lead | 0.35 | TASK_NONCOMPLETION (3/4 sessions) | **TRUE FAILURE** |

## Summary

| Classification | Count | Percentage |
|---|---|---|
| **TRUE FAILURE** | 10 | 50% |
| **EVALUATOR ARTIFACT** | 4 | 20% |
| **DEFENSIBLE ALTERNATIVE** | 1 | 5% |
| **AMBIGUOUS** | 5 | 25% |

## Key Findings

### Finding 1: 20% are evaluator infrastructure failures (not agent failures)
4/20 sessions scored 0.0 because the evaluator couldn't find/read the transcript. These are **MISSING_TRANSCRIPT** artifacts — the evaluator gives quality=0.0 when it has no data to evaluate. This is the evaluator scoring itself, not the agent.

**Impact**: These false zeroes drag down agent metrics and mask real performance. A simple fix: evaluator should return `null`/unscored when transcript is missing, not 0.0.

### Finding 2: "Task/objective mismatch" may hide defensible alternatives
Session s_1775664796622_77 (bob, q=0.2) was flagged for "task/objective mismatch" — the evaluator expected one output shape but the agent produced a different but potentially valid approach. This matches the Agreement Trap pattern from DD#883.

### Finding 3: AMBIGUOUS cases (25%) need deeper investigation
5/20 sessions had truncated evaluation summaries, making classification impossible. This suggests the evaluator's output format loses critical information for meta-analysis.

### Finding 4: The dominant true failure mode is TASK_NONCOMPLETION (8/10 true failures)
This isn't an agreement trap issue — agents genuinely didn't finish their tasks. Defensibility analysis wouldn't help here.

## Phase 1 Verdict: **PROCEED WITH CAUTION to Phase 2**

The 30% threshold is met if we count EVALUATOR ARTIFACT + DEFENSIBLE ALTERNATIVE + half of AMBIGUOUS = 4 + 1 + 2.5 = 37.5%. But the composition matters:
- The biggest win isn't "defensibility scoring" — it's **fixing the MISSING_TRANSCRIPT → 0.0 bug**
- True defensible alternatives are only ~5% of low scores (less than hypothesized 30-50%)
- The real evaluator noise is **infrastructure artifacts**, not agreement traps

### Revised Phase 2 Plan
Instead of building full defensibility scoring, focus on:
1. **Fix MISSING_TRANSCRIPT → 0.0 scoring** (structural fix, high ROI per meta-protocol)
2. **Add "unevaluable" category** when transcript isn't available
3. **Expand AMBIGUOUS cases** — get full issue text for the 5 truncated ones
4. Revisit defensibility scoring only if more data supports it
