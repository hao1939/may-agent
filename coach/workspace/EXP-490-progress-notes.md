# EXP-490 Progress Notes

## Status: DATA_COLLECTION_BLOCKED → NEEDS_SESSION_DATA

**Date**: 2025-07-28

## Current State

EXP-490 design is complete. Bob's skill inventory confirmed:
- **Active skills (16)**: cross-reference-source-code, evidence-over-narrative, gym-execution-checklist, know-when-blocked, knowledge-base-navigation, obstacle-pivot (WAIT - now demoted), persistent-task-workflow, plan-once-amend, read-before-edit, read-only-finish-protocol, state-check-before-action, verification, verify-before-finish
- **Demoted (3)**: obstacle-pivot.md, diagnosis-before-action.md, verify-after-edit.md

## Updated Target Skills for Scan

Per the design, 8 skills had "Unknown" impact. Post-demotions, remaining targets:

| # | Skill | Still Active? | Notes |
|---|-------|--------------|-------|
| 1 | cross-reference-source-code | ✅ | In context.md Required Skills |
| 2 | evidence-over-narrative | ✅ | In context.md Required Skills |
| 3 | know-when-blocked | ✅ | Active in skills/ |
| 4 | persistent-task-workflow | ✅ | In context.md Required Skills |
| 5 | plan-once-amend | ✅ | Active in skills/ |
| 6 | state-check-before-action | ✅ | Active in skills/ |
| 7 | verification | ✅ | Active in skills/ |
| 8 | verify-before-finish | ✅ | In context.md Required Skills |

All 8 targets still active.

## Data Collection Challenge

No recent bob sessions found in `.state/sessions/` (session store doesn't retain agent field reliably for bob). Available data sources:
1. **Gym results**: `.state/gym/results/20260424T*/` — 4 scenarios × multiple runs
2. **Checkpoints**: `chk_recovery_bob.json`, `manual_test_bob.json`
3. **Bob's workspace outputs**: synthesis files show bob was active

## Next Steps

1. Use gym results as proxy data (controlled scenarios, can check compliance signals)
2. Wait for next bob heartbeat sessions to collect naturalistic data
3. Alternative: run bob through 3-5 gym scenarios and audit live

## Connection to Bob's Notification

Bob demoted 2 skills per EXP-305. This is INPUT to EXP-490 — confirms the pruning pipeline works. EXP-490 extends it to the remaining 8 unknowns.

## Update 2028-07-29: Gym Scenario Created

Created `.state/gym/scenarios/skill-compliance-audit/` to unblock data collection:
- Tests 6 of 8 target skills in a single scenario (state-check, read-before-edit, plan-once-amend, evidence-over-narrative, know-when-blocked, cross-reference)
- Scenario: fix a flaky test after a prior agent left unknown state (triggers all target behaviors)
- Weighted scoring (max 5.5, pass ≥ 3.5)
- Remaining 2 skills (persistent-task-workflow, verification) need multi-session scenarios

**Next step**: Run bob through this scenario 3x, score compliance, then decide promote/demote for each skill.
