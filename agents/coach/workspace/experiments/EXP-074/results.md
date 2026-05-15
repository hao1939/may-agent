# EXP-074 Results: CLOSED — No Gym Runs Executed

**Status**: CLOSED (pre-baseline assessment)
**Date**: 2026-04-08
**Gym runs used**: 0 / 12 budget

## Summary

EXP-074 was closed before any gym runs because all FM-3.1 (ghost deliverable) scenarios are at ceiling (100% baseline pass rate). The experiment's treatment (rubric + exemplar context injection per AECRM Method 23) cannot be tested without a non-ceiling scenario.

## Key Finding

**FM-3.1 is structurally untestable in the current gym architecture.** Three factors prevent ghost deliverables from manifesting in gym:

1. **`finish()` tool validation** catches claims without corresponding writes
2. **Single-session fresh state** prevents multi-session drift that causes production FM-3.1
3. **Small environments** (3-12 files) make verification trivial — agent reads everything

This reinforces EXP-065's finding that FM-3.1 requires multi-session, large-environment testing that the current gym cannot support.

## Secondary Finding

Even if a non-ceiling scenario existed, **KE-002 predicts rubric context would have 0% effect**. Rubric is a text-based intervention (telling the agent what quality looks like). KE-002 shows 0/20 success rate for text-based behavioral changes on judgment tasks. The DD#598 claim was measured on human-AI collaboration, not autonomous agents.

## Recommendation

Method 23 (AECRM) should be tested via **production A/B measurement**, not gym:
1. Add rubric/exemplar sections to one agent's context files
2. Monitor FM-3.1 rate in that agent's ERROR_LOG over 48h
3. Compare to pre-intervention baseline

This bypasses both the gym ceiling problem and provides evidence on real FM-3.1 patterns.

## Cross-References

| Experiment | Finding | Relevance |
|-----------|---------|-----------|
| EXP-067 | ghost-deliverable-detection = 100% ceiling | Direct predecessor |
| EXP-068 | partial-ghost-deliverable = 100% ceiling | Direct predecessor |
| EXP-065 | FM-3.1 requires multi-session testing | Structural gap analysis |
| KE-002 | Text rules = 0% for judgment | Predicts rubric failure |
| KE-010 | Most scenarios ceiling | Validated again for FM-3.1 |
