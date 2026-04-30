# EXP-248: Belief-State Externalization vs Verification Gravity Wells

**Date**: 2026-04-29
**Status**: COMPLETE — FALSIFIED
**Predecessor**: EXP-099 (verification gravity well discovery)
**Hypothesis**: H-072 (Belief-State Externalization Reduces Verification Gravity Wells)

---

## Research Question

Does adding a belief-state externalization step before verification reduce FM-3.3 gravity well errors?

## Hypothesis

- **H-248a**: Adding "state your current understanding" before verification actions reduces FM-3.3 rate by ≥30%
- **H-248-null**: Belief externalization has no effect on gravity well rate; errors are caused by tool limitations, not corrupted beliefs

## Design

### Intervention

A context guard added to the agent that says:
> Before verifying any edit or file state, state in 1-2 sentences: (1) what you believe the current state is, (2) what you're trying to confirm, (3) what would surprise you.

This makes implicit beliefs explicit, allowing the agent to catch belief-reality divergence before it compounds.

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (current guards) | 10 | Standard verification behavior |
| B   | + belief externalization guard | 10 | Added metacognitive prompt before verify steps |

### Scenario

- Gym scenarios that historically trigger FM-3.3 gravity wells
- Need to identify 2-3 scenarios with >20% gravity well rate from EXP-099 data
- Candidates: edit-heavy scenarios with multi-step verification chains

### Metrics

- Primary: FM-3.3 gravity well occurrence rate (binary per session)
- Secondary: Total verification tool calls per session (fewer = less looping)
- Secondary: Session completion rate

### Decision Rule

- Confirmed if: FM-3.3 rate drops ≥30% (e.g., from 20% to ≤14%) with p<0.1
- Falsified if: FM-3.3 rate unchanged or increases
- Inconclusive if: <30% drop but directionally positive — expand N

## Pre-requisites

1. Identify gym scenarios with known FM-3.3 occurrence (query EXP-099 data)
2. Validate that the belief-externalization prompt doesn't break normal flow (run 2-3 pilot sessions)
3. Define clear FM-3.3 detection criteria for scoring transcripts

## Execution

```bash
# Phase 1: Identify target scenarios
# Query gym results for FM-3.3 occurrences

# Phase 2: Pilot (2-3 sessions with guard, check for usability)

# Phase 3: Full run
# scripts/gym-run.sh <scenario> --agent bob --tag EXP-248-A (control)
# scripts/gym-run.sh <scenario> --agent bob --tag EXP-248-B (treatment, with guard)
```

## Next Steps

1. Find EXP-099 data to identify high-FM-3.3 scenarios
2. Draft the exact guard text
3. Pilot test the guard for usability
