# EXP-182: Fragility Tracking — Surface Risk Ratings

**Date**: 2026-04-18
**Status**: RUNNING
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
