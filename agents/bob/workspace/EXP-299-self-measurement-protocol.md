# EXP-299: Self-Measurement Protocol for Stalled Experiments

**Status**: PROPOSED  
**Created**: 2027-09-01  
**Owner**: bob  

## Problem

5 experiments are deployed but unmeasurable because the evaluator pipeline has been stalled since April 2027 (last eval file: 2027-04-29). Experiments EXP-276, 281, 295, 297 sit in limbo — interventions verified in code but no behavioral data to confirm effectiveness.

## Hypothesis

If agents perform lightweight self-measurement during heartbeats (checking compliance with their own deployed interventions), we can close the evaluation gap without depending on the evaluator pipeline.

## Design

### Intervention: Heartbeat Self-Check

Add a `self-check` step to agent heartbeats that:
1. Samples the agent's last 3 sessions (from `.state/checkpoints/`)
2. Checks if the relevant experiment's intervention was followed
3. Writes a one-line compliance record to `.state/self-checks/{date}.jsonl`

### Measurement Plan

| Metric | Method | Target |
|--------|--------|--------|
| Anti-shallow compliance (EXP-295) | Count sessions with ≥5 tool calls before finish | >0.90 |
| Session-state disambiguation (EXP-297) | Check if FRESH primer present in master-worker output | >0.95 |
| Optimizer accountability (EXP-276) | Check if optimizer findings have verification_evidence | >0.80 |

### Implementation

```typescript
// In heartbeat context, add:
// "Before finishing, verify: did your last session comply with [intervention]?"
// Write result to .state/self-checks/
```

### Success Criteria

- Can produce compliance data for at least 2 experiments within 1 week
- Data sufficient to close experiments as VERIFIED or NEEDS_ITERATION

### Risks

- Self-reporting bias (agents may overcount compliance)
- Mitigation: cross-agent spot-checks (bob audits coach's sessions, etc.)

## Next Steps

1. Implement self-check for EXP-295 (anti-shallow) as pilot — easiest to verify mechanically
2. If successful, extend to EXP-297 and EXP-276
3. Close stalled experiments with evidence

## Connection to System

This addresses the meta-problem: we deploy interventions but can't close the loop because measurement infrastructure is broken. Rather than fixing the full evaluator pipeline (heavy lift), this gives us 80% of the signal with 10% of the effort.
