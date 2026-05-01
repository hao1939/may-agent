# EXP-274: <Short title — workflow-level-verification-gate>

**Date**: 2026-05-01
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

Does injecting a mandatory verification step at the workflow layer (before finish() is allowed) reduce VERIFICATION_FAILURE rates more than text-based context rules?

## Hypothesis

- **H-274a**: <primary prediction>
- **H-274-null**: <null / no-effect case>

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
# scripts/gym-run.sh <scenario> --agent <name> --tag EXP-274
```
