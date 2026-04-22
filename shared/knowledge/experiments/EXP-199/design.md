# EXP-199: <Short title — tool-assisted-relational-bug>

**Date**: 2026-04-22
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

Can providing a pipeline-swap tool help agents discover relational bugs they cannot find through instructions alone?

## Hypothesis

- **H-199a**: <primary prediction>
- **H-199-null**: <null / no-effect case>

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
# scripts/gym-run.sh <scenario> --agent <name> --tag EXP-199
```
