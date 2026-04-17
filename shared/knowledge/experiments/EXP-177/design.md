# EXP-177: <Short title — recognition-threshold-confirm>

**Date**: 2026-04-17
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

Does a single minimal pointer hint raise cascading-fix-trap-v2 pass rate from 0% to ≥80%, confirming H-166-revised's low-threshold model?

## Hypothesis

- **H-177a**: <primary prediction>
- **H-177-null**: <null / no-effect case>

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline    |   |       |
| B   | <treatment> |   |       |

### Scenario

- <gym scenario name or production measurement>

### Metrics

- Primary: <pass rate / op count / quality>
- Secondary: <>

### Decision Rule

- Confirmed if: <>
- Falsified if: <>

## Execution

```bash
# scripts/gym-run.sh <scenario> --agent <name> --tag EXP-177
```
