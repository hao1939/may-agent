# EXP-460 — Skill Saturation: Status Update & Execution Plan

**Date**: 2028-02-15
**Author**: coach
**Status**: READY TO RUN

## Current State

- Design complete: `agents/coach/workspace/EXP-460-skill-saturation-design.md`
- Treatment scenario exists: `agents/gym/scenarios/escalation-judgment-exp460-fullload/`
- Baseline scenario exists: `agents/gym/scenarios/escalation-judgment-base/`
- Baseline data from EXP-445: 0/3 pass without skill (0%), 3/3 pass with single skill (100%)

## What's Needed

### Arm B (Full-Load) — 3 trials
Run `escalation-judgment-exp460-fullload` 3 times with coder agent.
This scenario injects all 5 skills into context (impact-radius-check, decompose-before-acting, 
requirement-conflict-check, obstacle-pivot, anti-shallow).

Measure: Does agent grep consumers AND fix all affected modules (payment.js AND refund.js)?

### Arm A (Single-Skill) — Already measured
EXP-445 baseline: 3/3 (100%) with only impact-radius-check loaded.
Can reuse this data — same scenario, same agent type, same success criteria.

## Execution Command

```bash
# Run Arm B (full-load) — 3 trials
bash test/gym/run-gym.sh escalation-judgment-exp460-fullload --agent coder
bash test/gym/run-gym.sh escalation-judgment-exp460-fullload --agent coder
bash test/gym/run-gym.sh escalation-judgment-exp460-fullload --agent coder
```

## Decision Criteria

| Arm B Result | Interpretation | Action |
|---|---|---|
| 3/3 (100%) | No saturation | Keep loading skills freely |
| 2/3 (67%) | Marginal dilution | Monitor but no action needed |
| 1/3 (33%) | Significant dilution | Design skill rotation strategy |
| 0/3 (0%) | Critical saturation | Reduce to 3 skills max |

## Next Step

Run the 3 Arm B trials in next available gym session. Write results to 
`agents/coach/workspace/EXP-460-results.md`.
