# Evaluator Score Batch 1 — Patterns

**Batch**: 50 most recent evaluated sessions  
**Heuristic version**: v1 (signal-heuristics.md)  
**Date**: 2026-05-22

## Key Findings

### 1. Canonical evaluator assigns near-uniform scores to "good" sessions

90% of sessions (45/50) receive `verdict=good` with quality=0.85 and efficiency=0.80.
The heuristic evaluator (v9) uses fixed score buckets rather than continuous scoring,
producing a flat distribution that cannot distinguish between a 3-op routing session
and a 70-op deep engineering session.

**Evidence**: Sessions `s_1779363767893_160` (4 ops, routing) and `s_1779352614089_86`
(70 ops, deep probe refinement with recovery from 8 wasted calls) both receive
quality=0.85 from the canonical evaluator.

### 2. "Shallow session" is the only negative heuristic with teeth

All 4 `needs_improvement` verdicts are triggered by a single rule: `opCount <= 2`.
The canonical evaluator has no intermediate degradation signals between "shallow" (2 ops)
and "good" (3+ ops with finish).

### 3. v1 heuristic scores also collapse to top of range

The independent heuristic scoring produces 45/50 sessions at score 5 (1–5 scale),
confirming that the v1 weights and signals lack discriminating power on well-behaved
sessions. The heuristics only separate clearly-broken sessions.

### 4. Deep-eval sessions show richer signal but are rare

Only 2/50 sessions received deep (LLM) evaluation. These produce detailed issue lists,
failure chains, and usage breakdowns that the heuristic evaluator cannot replicate.
The deep-eval sessions are the only ones with non-trivial issue content.

### 5. aks-explorer gets lower efficiency scores but same verdict

Sessions with 30–70 ops get `efficiency=0.55` but still `verdict=good`. The efficiency
dimension does not influence the verdict — it's informational only.

## Verdict Distribution (batch)

| Verdict | Count | Avg Quality | Avg Efficiency |
|---------|-------|-------------|----------------|
| good | 45 | 0.85 | 0.78 |
| needs_improvement | 4 | 0.55 | 0.80 |
| acceptable | 1 | 0.65 | 0.80 |

## Heuristic Score Distribution (v1)

| Score (1-5) | Count |
|-------------|-------|
| 5 | 45 |
| 4 | 2 |
| 3 | 3 |

## Conclusion

Both the canonical evaluator and the v1 heuristics suffer from **ceiling compression**:
the vast majority of sessions that complete without errors cluster at the maximum score.
This makes the evaluator unable to distinguish "adequate" from "excellent" sessions,
limiting its value for calibration and learning feedback.
