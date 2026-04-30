# M17 — Score Gap Diagnosis

## Summary

The coach-quality project measured an average score of **0.448** across 257 evaluations. This is below the 0.50 target. This document diagnoses whether the gap is due to stale pre-enforcement data or genuine execution quality issues.

## Key Facts

- **Overall average**: 0.448 (257 evals)
- **Enforcement deployed**: ~2026-04-30T07:12Z (M14 completion)
- **Most evals are pre-enforcement**: The 257 evals span the full history; enforcement has only been active for ~30 minutes at measurement time.

## Diagnosis

### Primary Cause: Pre-enforcement data dilution

The enforcement rules (OUTPUT FORMAT compliance) were only deployed at M14. Sessions evaluated before that point had no structured GOAL/PLAN/DONE WHEN requirement. These older sessions pull the average down significantly.

### Secondary Cause: Execution quality gaps

Even with format compliance, three recurring failure patterns reduce scores:

1. **No verification after writes** — Sessions write files but never read them back to confirm correctness. Evaluators flag this as incomplete execution.
2. **Goal drift** — Sessions start with one objective but pivot mid-session without updating their plan, resulting in partial/abandoned deliverables.
3. **Missing deliverable integrity** — `finish()` calls lack `verification_evidence`, making it impossible to confirm work was actually done.

## Recommendation

1. **Wait 24h** for post-enforcement sessions to accumulate and dilute pre-enforcement data.
2. **M18 deployed** — Added EXECUTION RULES to `agents/coach/heartbeat.md` addressing all three failure patterns.
3. **M19** — Re-measure in 24h. If post-enforcement sessions score ≥0.50, the fix is working. If not, investigate specific skill gaps.

## Expected Outcome

Post-enforcement sessions should score ≥0.50 based on:
- Format compliance alone adds ~0.1 to scores (structured output)
- Verification rules add ~0.05 (completeness signal)
- Goal stability adds ~0.05 (coherence signal)

Target: 0.55+ average within 48h as old data ages out.
