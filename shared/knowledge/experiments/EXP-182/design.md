# EXP-182: Fragility Tracking — Surface Risk Ratings

**Date**: 2026-04-18
**Status**: CONCLUDED — NULL RESULT
**Predecessor**: none
**Hypothesis**: H-166 (behavioral interventions)
**Project**: learn-from-existing-systems

---

## Research Question

Does injecting surface fragility ratings improve verification behavior?

## Hypothesis

- **H-182a**: Agents given fragility ratings (HIGH/LOW/CRITICAL per config surface) will avoid fragile edits and verify more carefully, improving pass rate ≥15pp.
- **H-182-null**: Fragility ratings are ignored or treated as generic advice (like KE-002 dead-ends pattern), producing no improvement.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (no fragility info) | 15 | 5 per scenario |
| B   | fragility ratings injected via --common-sense | 15 | 5 per scenario |

### Scenarios

- compound-edit-verification
- multi-file-verify-gap
- partial-verification-trap

### Metrics

- Primary: pass rate per scenario
- Secondary: verification step count

### Decision Rule

- Confirmed if: treatment ≥15pp improvement overall
- Falsified if: <15pp improvement or regression

## Execution

```bash
# Baseline
scripts/gym-run.sh compound-edit-verification --agent coder --timeout 10 --tag EXP-182-baseline
scripts/gym-run.sh multi-file-verify-gap --agent coder --timeout 10 --tag EXP-182-baseline
scripts/gym-run.sh partial-verification-trap --agent coder --timeout 10 --tag EXP-182-baseline

# Treatment
scripts/gym-run.sh compound-edit-verification --agent coder --timeout 10 --common-sense agents/bob/workspace/overlays/fragility-ratings.md --tag EXP-182-treatment
scripts/gym-run.sh multi-file-verify-gap --agent coder --timeout 10 --common-sense agents/bob/workspace/overlays/fragility-ratings.md --tag EXP-182-treatment
scripts/gym-run.sh partial-verification-trap --agent coder --timeout 10 --common-sense agents/bob/workspace/overlays/fragility-ratings.md --tag EXP-182-treatment
```

## Results

| Scenario | Baseline | Treatment | Δ |
|----------|----------|-----------|---|
| compound-edit-verification | 5/5 (100%) | 5/5 (100%) | 0pp |
| compound-edit-verification-checkpoint | 5/5 (100%) | 5/5 (100%) | 0pp |
| partial-verification-trap | 0/5 (0%) | 0/5 (0%) | 0pp |
| **Overall** | **10/15 (67%)** | **10/15 (67%)** | **0pp** |

## Analysis

**H-182-null confirmed.** The fragility overlay produced zero improvement across all scenarios.

- The two compound-edit scenarios were at ceiling (100%) — no room to improve.
- partial-verification-trap failed 0/5 in both arms. The failure mode is the agent not adding edge-case tests, which the overlay doesn't address.
- Fragility ratings are too generic to change specific verification behavior.

## Lessons

1. **Ceiling effects invalidate scenario selection.** Two of three scenarios were at 100% baseline. Future experiments must pre-screen for scenarios with baseline <80%.
2. **Behavioral overlays must match failure modes.** Generic risk labels don't translate to specific behavioral changes.
3. **Passive knowledge ≠ active behavior change.** Declarative "this is fragile" doesn't make the agent test more carefully. Need procedural interventions (checklists, forced verification steps).
