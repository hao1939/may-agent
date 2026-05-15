# EXP-490 Phase 2 Results: Bob Skill Compliance Gym Measurement

**Date**: 2028-07-10
**Status**: CLOSED — DEMOTION RECOMMENDED
**Author**: coach

## Summary

Measured 3 bob skills across 3 gym trials each. Two skills show 0% compliance and should be demoted. One skill shows 100% compliance and should be kept.

## Results

| Skill | Scenario | Trial 1 | Trial 2 | Trial 3 | Pass Rate | Decision |
|-------|----------|---------|---------|---------|-----------|----------|
| verify-before-finish | verify-before-finish | 7/7 ✅ | 7/7 ✅ | 7/7 ✅ | **100%** | KEEP |
| read-before-edit | read-before-edit | 7/11 ❌ | 7/11 ❌ | 7/11 ❌ | **0%** | DEMOTE |
| state-check-before-action | state-check-before-mutation | 3/7 ❌ | 3/7 ❌ | 3/7 ❌ | **0%** | DEMOTE |

## Analysis

### read-before-edit (DEMOTE)
- Agent consistently edits files without reading them first
- The "read-before-edit" instruction in bob/context.md has ZERO behavioral effect
- Confirms KE-480: text coaching is dead for verification behaviors
- 3/3 trials show identical failure pattern (C1 checks for read-before-edit on individual files all fail)

### state-check-before-action (DEMOTE)
- Agent does not check file contents before mutating them
- All pre-mutation read checks fail across 3 trials
- Post-edit verification also fails — agent doesn't verify after either
- Same KE-480 pattern: text instruction → no compliance

### verify-before-finish (KEEP)
- Agent consistently verifies work before calling finish()
- 100% compliance across 3 trials (7/7 checks each)
- This skill IS working — keep deployed

## Demotion Recommendation

Move to `.demoted/`:
1. `read-before-edit.md` — 0% compliance, text coaching dead (KE-480)
2. `state-check-before-action.md` — 0% compliance, text coaching dead (KE-480)

These skills add context cost (~200 tokens each) with zero behavioral return.

## Connection to Stalled Experiments Audit

This closes 2 of the 5 stalled experiments identified in the audit:
- EXP-490 (this experiment) — now CLOSED with clear data
- EXP-285 (PATH_HALLUCINATION guard) — remains blocked on evaluator

The audit's finding that "text-based coaching has near-zero hit rate" is further confirmed by these results.

## Next Steps

1. Demote read-before-edit and state-check-before-action from bob/context.md
2. Only scaffold/structural interventions should be tried for these behaviors (per KE-480)
3. EXP-495 (write-first scaffold) is the correct intervention category — await measurement
