# EXP-575: Formal Closure Decision

**Date**: 2029-05-18
**Status**: CLOSED — REFRAMED as P2 (solved-by-infrastructure)
**Duration**: 2028-08-27 → 2029-05-18 (9 months)

## Summary

EXP-575 proposed auto-injecting `read()` after every `edit()`/`write()` to raise verify-after-edit compliance from 9.7% to ~100%. After exhaustive investigation:

1. **8 text interventions failed** (EXP-280, 340, 350, 495, 565, 580 + 2 others)
2. **Tech-lead confirmed runtime binary is immutable** — cannot modify tool dispatch
3. **Edit failure audit revealed the problem is already structurally mitigated**:
   - Silent corruption rate: ~0% (edit tool rejects bad matches)
   - Edit rejection rate: 12.2% (loud failures, not silent)
   - EXP-500 pre-read injection handles the information-gap case

## Decision: CLOSE as REFRAMED

### Why not pursue further
- The `edit()` tool already validates internally — silent corruption is near-zero
- The diff preview in edit responses provides passive verification
- The runtime binary cannot be modified (tech-lead confirmed)
- 9 months and 8+ experiments produced +7.7pp total (9.7% → 17.4%)
- ROI is negative — continued investment yields diminishing returns

### What verify-after-edit actually measures now
Not "are agents catching corruption" (solved) but "are agents making a redundant read() after a tool that already shows them the diff." The metric measures ceremony, not safety.

### Residual risk: edit rejection waste (12.2%)
This is a **different problem** (stale context → bad oldText) better addressed by:
- Strengthening EXP-500 pre-read injection
- Investigating concurrent-edit patterns
- Tracked as P2 follow-up, not P0

## Evidence Chain

| Evidence | Source |
|----------|--------|
| 17.4% verify rate after all interventions | EXP-575-remeasurement-may2029.md |
| 12.2% edit rejection rate (loud, not silent) | EXP-575-edit-failure-rate-audit.md |
| Runtime binary immutable | Tech-lead response (EXP-575 re-escalation) |
| Text coaching dead for this behavior | KE-480, EXP-565 production measurement |
| Edit tool prevents silent corruption | EXP-575-alternative-approaches-analysis.md Option 4 |

## Impact on todo.md

- Remove EXP-575 from P0 items
- Add P2: "Investigate edit rejection patterns (12.2% rate)" 
- Add P2: "Evaluate if verify-after-edit metric should be retired"

## Lessons Learned

1. **Not all low metrics indicate real problems** — verify-after-edit compliance is low, but the harm it was supposed to prevent (silent corruption) is already solved by tool-level validation
2. **Know when to stop** — 8 experiments + 9 months is excessive for a single behavior. After 3 failures, reframe the question
3. **Structural solutions work but have limits** — when the runtime is immutable, structural fixes at the prompt/workflow level cap out at ~17%
