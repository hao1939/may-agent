# EXP-205: <Short title — multi-agent-relational-discovery>

**Date**: 2026-04-23
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

Can a second-pass agent reviewing from a different frame discover relational bugs that single agents miss?

## Hypothesis

- **H-205a**: <primary prediction>
- **H-205-null**: <null / no-effect case>

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
# scripts/gym-run.sh <scenario> --agent <name> --tag EXP-205
```
