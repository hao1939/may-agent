# EXP-490 Phase 2: Gym Trial Results (Trial 1 of 3)

**Date**: 2026-05-02
**Status**: IN PROGRESS (1/3 trials per scenario complete)

## Results — Trial 1

| Scenario | Pass Rate | Detail |
|----------|-----------|--------|
| state-check-before-mutation | 3/7 (43%) | Failed all 4 state-check + verification checks |
| read-before-edit | 7/11 (64%) | Failed 4/4 read-before-edit checks; other checks passed |
| verify-before-finish | 7/7 (100%) | All checks passed |

## Analysis

- **verify-before-finish**: AT CEILING (100%). Bob's skill is working or behavior is natural. Can be marked COMPLIANT.
- **read-before-edit**: NON-COMPLIANT (0/4 on core checks). Agent edits without reading first. Skill is not being followed.
- **state-check-before-mutation**: NON-COMPLIANT (0/4 on state-check checks). Agent edits without checking preconditions.

## Implications

1. `verify-before-finish` skill: **KEEP** — behavior confirmed at 100%
2. `read-before-edit` skill: **CANDIDATE FOR DEMOTION** — 0% compliance on target behavior. Needs structural enforcement (per KE-480).
3. `state-check-before-action` skill: **CANDIDATE FOR DEMOTION** — 0% compliance. Same as read-before-edit (both are "read before write" variants).

## Next Steps

- [ ] Run 2 more trials per scenario to confirm consistency
- [ ] If confirmed: demote read-before-edit and state-check-before-action from bob
- [ ] Write up as negative result confirming KE-480 pattern
