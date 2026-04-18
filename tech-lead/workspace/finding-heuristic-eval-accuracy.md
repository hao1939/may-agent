# Finding: Heuristic Evaluation Systematically Over-Rates Quality

**Lens**: D (Fragility)  
**Date**: 2026-04-18  
**Severity**: Medium — inflates quality metrics, masks real problems

## Summary

The heuristic evaluator in `evaluation-sync.ts` systematically over-rates session quality by ~0.12 points (avg 0.74 heuristic vs 0.62 LLM on non-skipped sessions). The root cause is that the heuristic defaults ALL "done" sessions to quality=1.0 and can only downgrade to 0.75 for high waste — it has no ability to assess actual output quality, task completion, or correctness.

## Evidence

### Score Distribution Comparison (non-skipped sessions only)

| Metric | Heuristic (n=18,439) | LLM (n=2,656) |
|--------|---------------------|----------------|
| Avg Quality | 0.74 | 0.62 |
| Avg Efficiency | 0.64 | 0.60 |

### Quality Bucket Distribution

| Bucket | Heuristic % | LLM % |
|--------|------------|--------|
| 0.9–1.0 | 30% (5,530) | 12% (323) |
| 0.7–0.9 | 48% (8,888) | 43% (1,142) |
| 0.5–0.7 | 10% (1,770) | 16% (418) |
| 0–0.5 | 12% (2,251) | 29% (773) |

The heuristic clusters heavily in 0.7–1.0 (78%), while LLM spreads more broadly with 29% scoring below 0.5.

### Root Cause in Code

The heuristic scoring logic (`evaluation-sync.ts:208-229`) has only 3 quality levels:
- **1.0** — default for all "done" sessions (`evaluation-sync.ts:208`)
- **0.75** — if high waste ratio >20% (`evaluation-sync.ts:214-215`)  
- **0.1** — error sessions (`evaluation-sync.ts:175`)

There is no assessment of:
- Whether the session actually completed its task
- Output quality or correctness
- Whether deliverables were produced

Additionally, shallow sessions (≤2 ops) automatically get Q:1.0, E:0.8 (`evaluation-sync.ts:187-189`), which inflates scores for sessions that may have done nothing useful.

### Verdict Distribution Skew

| Verdict | Heuristic | LLM |
|---------|-----------|-----|
| good | 65% (12,005) | 41% (1,094) |
| acceptable | 32% (5,900) | 32% (840) |
| needs_improvement | 3% (534) | 27% (722) |

The heuristic almost never flags "needs_improvement" (3%) while LLM flags it 27% of the time.

## Impact

- **Quality metrics are inflated**: Any dashboard or metric using heuristic evaluations shows a rosier picture than reality. 74% of evaluations are heuristic-only (18,696 of 25,122 total).
- **Problems go undetected**: Sessions that complete but produce low-quality output get Q:1.0 from the heuristic.
- **Delegation quality metric affected**: The 0.80 delegation quality metric (investigated in Lens B) may be inflated by heuristic evaluations of delegated sessions.

## Recommended Action (follow-up, not this session)

1. **Short-term**: When computing aggregate quality metrics, weight LLM evaluations higher or filter to LLM-only for accuracy-sensitive dashboards.
2. **Medium-term**: Add more heuristic signals — check for deliverable existence, finish() status, error patterns — to create a 5-tier quality scale instead of the current binary (1.0 or 0.75).
3. **Long-term**: Increase LLM evaluation sampling rate from ~30% for high-value sessions (delegated tasks, feature work).
