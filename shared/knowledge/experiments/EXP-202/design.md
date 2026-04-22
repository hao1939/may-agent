# EXP-202: H-187 Meta-Cognitive Defect Enumeration Checklist

**Date**: 2026-06-22
**Status**: RUNNING
**Predecessor**: EXP-199 (tool-assisted, 0/10), EXP-198 (procedural, 0/10), EXP-195 (direct hint, 4/10)
**Hypothesis**: H-187

---

## Research Question

Does a meta-cognitive defect enumeration prompt (listing bug categories) improve pass rates on cascading-fix-trap-v2?

## Hypothesis

- **H-202a**: Enumeration checklist achieves ≥15% (≥2/10) pass rate on cascading-fix-trap-v2
- **H-202-null**: No improvement — enumeration is just another procedural intervention that doesn't crack the discovery gap

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (EXP-195 data) | 10 | Reuse: 1/10 pass rate |
| B   | task.md + defect category enumeration | 10 | 5 categories listed |

### Scenario

- cascading-fix-trap-v2 (Arm A baseline)
- cascading-fix-trap-v2-exp202-enum (Arm B)

### Metrics

- Primary: overall pass rate, pipeline-order-fixed rate
- Secondary: which checks fail

### Decision Rule

- Confirmed if: Arm B ≥ 2/10 (20%) overall pass
- Falsified if: Arm B 0/10

## Execution

```bash
# Arm B (10 trials)
node agents/gym/runner.js agents/gym/scenarios/cascading-fix-trap-v2-exp202-enum --trials 10 --tag EXP-202-B --timeout 600
```
