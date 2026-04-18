# EXP-181: Dead Ends Memory

**Date**: 2026-04-18
**Status**: RUNNING
**Predecessor**: none
**Hypothesis**: H-166 (FM-1.3 path-guessing pattern)

---

## Research Question

Does injecting a structured "dead ends" file into agent context reduce FM-1.3 (path-guessing, repeating known failures) errors?

## Hypothesis

- **H-181a**: Injecting dead-ends context reduces FM-1.3 errors by ≥15pp on at least 2 of 3 test scenarios
- **H-181-null**: Dead-ends context has no significant effect on FM-1.3 error rate

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline (no dead-ends) | 5 trials × 3 scenarios = 15 | Standard coder agent |
| B   | dead-ends overlay via --common-sense | 5 trials × 3 scenarios = 15 | Same agent + dead_ends.md |

### Scenarios

1. `stale-approach-fixation` — agent must read workspace notes, not guess paths
2. `stale-error-misdiagnosis-v2` — agent must investigate DB, not assume from error text
3. `cascading-fix-trap-v2` — agent must find root cause, not fix symptoms

### Intervention (Arm B)

Overlay file `dead-ends-overlay.md` injected via `--common-sense` flag. Contains general anti-patterns (NOT scenario-specific answers):
- Don't guess file paths — always `ls` first
- Don't assume error cause from message alone — investigate
- Don't fix symptoms without tracing to root cause
- Read workspace/context files before starting work
- If first approach fails, step back and re-examine assumptions

### Metrics

- Primary: pass rate (binary per trial)
- Secondary: tool call count (efficiency)

### Decision Rule

- Confirmed if: ≥15pp improvement on ≥2 of 3 scenarios, no regression >10pp on any
- Falsified if: <15pp improvement on all scenarios, or regression on any

## Execution

```bash
# Baseline (Arm A)
scripts/gym-run.sh stale-approach-fixation --agent coder --timeout 10 --tag EXP-181-baseline
scripts/gym-run.sh stale-error-misdiagnosis-v2 --agent coder --timeout 10 --tag EXP-181-baseline
scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --timeout 10 --tag EXP-181-baseline

# Treatment (Arm B)
scripts/gym-run.sh stale-approach-fixation --agent coder --timeout 10 --common-sense agents/bob/workspace/dead-ends-overlay.md --tag EXP-181-treatment
scripts/gym-run.sh stale-error-misdiagnosis-v2 --agent coder --timeout 10 --common-sense agents/bob/workspace/dead-ends-overlay.md --tag EXP-181-treatment
scripts/gym-run.sh cascading-fix-trap-v2 --agent coder --timeout 10 --common-sense agents/bob/workspace/dead-ends-overlay.md --tag EXP-181-treatment
```
