# Finding: Quality Preserved Metric at 0.887 — Root Causes

**Date**: 2026-04-18  
**Metric**: Quality preserved = 0.887 (target: 0.9)  
**Window**: Last 48h  

## Summary

The quality-preserved metric is dragged down by three distinct issues, roughly in order of impact:

1. **Coder agent is the worst non-meta agent** (avg quality 0.714, 33/41 sessions below 0.9)
2. **"Did not score" false zeros** — 9 sessions scored quality=0 because the evaluator failed to score them (not actual quality failures)
3. **Broad mediocrity across optimizer/bob/coach/tech-lead** (all 0.85-0.88 avg)

## Detailed Breakdown

### Agent Averages (48h, excluding evaluator/skipped)

| Agent | Avg Quality | Below 0.9 | Total |
|-------|------------|-----------|-------|
| coder | 0.714 | 33/41 | 80% below target |
| optimizer | 0.858 | 112/208 | 54% below target |
| bob | 0.862 | 70/183 | 38% below target |
| coach | 0.871 | 78/234 | 33% below target |
| may | 0.875 | 55/186 | 30% below target |
| tech-lead | 0.876 | 92/211 | 44% below target |
| qa | 0.915 | 21/98 | 21% below target |
| scout | 0.918 | 28/109 | 26% below target |

### Overall: 0.874 avg across 1,266 non-evaluator sessions

Excluding false-zero "did not score" sessions: **0.880** (1,257 sessions)

### Coder Issues (biggest drag)

Coder's 41 sessions average 0.714 — far below every other agent. Common issues:
- **SCOPE_VIOLATION**: Editing files outside allowed scope (multiple sessions at 0.45)
- **FM-2.6 reasoning-action mismatch**: Not following task instructions
- **FM-3.3 verification failures**: Finishing without post-write verification
- **FM-3.1 ghost deliverables**: Claiming work that wasn't done

Coder alone accounts for ~7.4 quality-point-sessions below target. If coder averaged 0.9 like qa/scout, the overall metric would rise by ~0.006.

### "Did Not Score" False Zeros

9 sessions got quality=0 because the evaluator itself failed (issues say "evaluator did not score this session"). These are scoring bugs, not quality bugs. Fixing these would raise the metric by ~0.006.

### Broad 0.85-0.88 Tier

Optimizer, bob, coach, may, tech-lead all hover at 0.85-0.88. The recurring issues are:
- FM-3.3 verification failures (optimizer especially — matches the active_recall warnings)
- Shallow sessions / session errors
- Process gaps in coach (misunderstanding cron contracts)

## Actionable Recommendations

1. **Coder intervention** (highest ROI): Coder's scope-violation pattern is a judgment failure — per KE-002, text rules won't fix this. Consider a **structural gate** that validates changed files against the allowed-file list before commit. Alternatively, a workflow that enforces scope checks.

2. **Fix evaluator not-scoring bug**: 9 false zeros from evaluator failures inflate the below-target count. This is a scoring infrastructure bug, not a quality bug.

3. **FM-3.3 is already being addressed**: The active recall shows multiple FM-3.3 guardrails are in place and catching issues. Compliance is improving.

4. **No single silver bullet**: Even fixing coder + false zeros only brings metric to ~0.892. Getting above 0.9 requires broad 1-2 point improvements across all agents, which suggests the target may be ambitious for the current system maturity.

## Conclusion

The 0.887 vs 0.9 gap is **not** a single-agent regression — it's a combination of coder underperformance (0.714 avg), evaluator scoring bugs (9 false zeros), and broadly mediocre quality across the middle tier. The highest-ROI fix is a structural intervention for coder's scope-violation pattern.
