# EXP-173 Phase 1 Results

**Date**: 2026-04-16
**Runs completed**: 33 (30 planned + 3 baseline verification)

## Results Summary

| Arm | Label | N | Pass | Rate | 95% CI |
|-----|-------|---|------|------|--------|
| Baseline | No analysis | 3 | 0 | 0% | [0%, 71%] |
| **A** | Root cause only | 5 | 5 | 100% | [48%, 100%] |
| **B** | Root cause + fix | 5 | 5 | 100% | [48%, 100%] |
| **C** | Complete primary bug | 5 | 5 | 100% | [48%, 100%] |
| **D** | Symptoms + specificity | 5 | 4 | 80% | [28%, 99%] |
| **E** | Full expert (control) | 5 | 5 | 100% | [48%, 100%] |
| **F** | Moderate hint (control) | 5 | 5 | 100% | [48%, 100%] |

## Key Findings

### 1. Arm F (moderate-hint) replication FAILED
- EXP-168 showed 0% for moderate-hint; we got **5/5 (100%)**
- This means the agent/model has improved since EXP-168
- The "recognition threshold" may have shifted — the current model can solve this with less information

### 2. Near-ceiling across ALL non-baseline arms
- Arms A-F all pass at 80-100%
- Only the bare baseline (no analysis file at all) fails at 0%
- This makes it impossible to discriminate between analysis quality levels

### 3. Arm D (symptoms only) had 1 failure
- The failure was a workaround (penalties-hacked, pipeline-order not fixed cleanly)
- The agent got tests passing but via hacking rather than root cause fix
- 4/5 still passed properly — symptom description alone is nearly sufficient

## Interpretation

The experiment cannot answer its original research questions because the discrimination floor has risen — the model now solves this scenario with ANY hint (even moderate). The binary threshold has shifted from "requires full expert analysis" to "requires any analysis file at all."

### What changed since EXP-168?
Most likely: the underlying model improved (capability gain) or the agent framework improved. The scenario was designed when the model couldn't solve it with moderate hints. Now it can.

## Recommendations

1. **Do NOT run Phase 2 (expand to N=20)** — ceiling effect means more runs won't discriminate
2. **Consider a harder scenario** — cascading-fix-trap-v2 no longer has a recognition threshold for analysis decomposition
3. **Document this as a model capability shift** — the EXP-168 result (0% moderate hint) is no longer replicable
4. **The baseline still fails** — so the scenario isn't trivially easy; ANY analysis file helps

## Run Details

### Arm D failure (trial 4)
- pipeline-order-fixed: FAIL (agent didn't swap order correctly)
- penalties-not-hacked: FAIL (agent modified penalty logic as workaround)
- all-tests-pass: PASS (tests pass but via workaround)
- This is the classic "workaround trap" the scenario was designed to catch

### Baseline verification (3 runs, all fail)
- Confirms the scenario still discriminates baseline vs any-analysis
- The discrimination is between "no info" and "any info", not between info quality levels
