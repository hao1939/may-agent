# EXP-505: Stalled Experiment Audit & Shipping Gate

**Date**: 2026-05-10
**Status**: DESIGNED
**Trigger**: Unshipped Findings Audit (5 experiments stalled)

## Problem Statement

Per the unshipped findings audit, 5 experiments are stalled in various states (DESIGNED, BASELINE_COMPLETE, TREATMENT_DESIGNED) without progressing to deployment or closure. Pattern identified: text-based coaching interventions have near-zero impact on behavior change.

The stalled experiments are likely stalled because:
1. They require structural implementation (code changes) that coach can't do alone
2. Their baselines showed ceiling/floor effects making measurement impossible
3. They're waiting on dead infrastructure (evaluator)

## Approach: Ship-or-Kill Gate

Rather than designing a new intervention, this experiment applies a **shipping gate** to all open experiments:

### Criteria for each stalled experiment:
- **SHIP**: Has positive result + clear deployment path → escalate for deployment
- **KILL**: Has negative/ceiling/inconclusive result → close with findings documented
- **ESCALATE**: Needs code change that coach can't make → escalate to tech-lead with spec

## Audit of Currently Open Experiments

| ID | Status | Action |
|----|--------|--------|
| EXP-500 | BASELINE_MEASURED | SHIP — ready for implementation, escalate to tech-lead |
| EXP-490 | DATA_COLLECTION | Already CLOSED per todo — update experiments.jsonl |
| EXP-480 (phantom-nudge) | READY_FOR_EXECUTION | KILL — can't execute without amy lab fork |
| EXP-475 | DEPLOYED | MEASURE — need 10+ post-treatment sessions |

## Meta-Finding: The Shipping Problem

The real pattern is:
1. **Positive gym results don't automatically ship** — there's no mechanism to promote gym-proven skills to production
2. **Structural interventions require code PRs** — coach designs them but can't implement
3. **Text coaching is confirmed dead** (KE-480) but we keep designing text experiments

## Proposed Fix: Structural-Only Experiment Policy

**New rule**: No new experiments testing text-based behavioral coaching. All new experiments must be:
- Structural (code change in workflows/tools)
- Scaffold (pre-created content that guides behavior)
- Environmental (changing what information is available)

This aligns with the confirmed knowledge from 6+ experiments (EXP-265, EXP-280, EXP-340, EXP-350, EXP-395, EXP-495).

## Success Criteria

- All stalled experiments resolved (shipped, killed, or escalated) within 2 heartbeats
- New experiment policy documented and followed
- EXP-500 escalated to tech-lead for implementation

## Next Actions

- [x] Audit stalled experiments (this document)
- [ ] Escalate EXP-500 to tech-lead with implementation spec
- [ ] Close any experiments stuck >30 days without progress
- [ ] Add structural-only policy to coach/context.md
