# EXP-201: Verification Remasking (H-185)

**Date**: 2026-06-22
**Status**: CONCLUDED — FALSIFIED for cascading-fix-trap-v2 (0/10, bottleneck is discovery not verification)
**Predecessor**: EXP-199 (tool-assisted relational bug), EXP-195 (baseline)
**Hypothesis**: H-185

---

## Research Question

Does a verification remasking instruction improve task completion on cascading-fix scenarios?

## Hypothesis

- **H-201a**: Remasking instruction increases pass rate by ≥15pp over baseline on cascading-fix-trap-v2
- **H-201-null**: Remasking instruction has no significant effect on pass rate

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (cascading-fix-trap-v2) | 10 | Reuse EXP-195 baseline data: 1/10 pass |
| B   | verification remasking instruction | 10 | cascading-fix-trap-v2-exp200-remask |

### Scenario

- cascading-fix-trap-v2 (baseline)
- cascading-fix-trap-v2-exp200-remask (treatment)

### Metrics

- Primary: overall pass rate
- Secondary: pipeline-order-fixed rate, duration

### Decision Rule

- Confirmed if: Treatment ≥ 25% pass rate (vs 10% baseline)
- Falsified if: Treatment ≤ 15% pass rate

## Execution

```bash
node agents/gym/runner.js --scenario cascading-fix-trap-v2-exp200-remask --agent bob --runs 10 --tag EXP-201 --timeout 600
```
