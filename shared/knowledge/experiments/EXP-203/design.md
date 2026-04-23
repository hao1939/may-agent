# EXP-203: <Short title — structured-handoff-format>

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

Does a structured handoff template (predictions + cross-refs + confidence) reduce Scout→Bob information loss from 48.8% to <25%?

## Hypothesis

- **H-203a**: <primary prediction>
- **H-203-null**: <null / no-effect case>

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
# scripts/gym-run.sh <scenario> --agent <name> --tag EXP-203
```
