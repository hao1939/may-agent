# EXP-174: Clean Replication of Scout-Generated Analysis

**Date**: 2026-04-16
**Status**: DESIGNED
**Predecessor**: EXP-172 (0% scout→coder), EXP-173 (contamination discovery + clean controls)

---

## Research Question

Does scout-generated analysis work when the environment isn't contaminated?

EXP-172 found 0% pass rate for scout→coder on cascading-fix-trap-v2. But EXP-173 discovered environment contamination affected all variants. After fixing contamination, moderate hints achieve 100% (not 0% as EXP-168 reported). This replication tests whether scout-generated analysis also achieves ~100% with clean environments.

**This is the critical experiment**: If scout→coder achieves ~100% with clean environments, it means the 0% result in EXP-172 was a contamination artifact, and the entire binary-threshold model (H-166) collapses. If it's still 0%, the problem is genuinely that LLM-generated analysis is qualitatively different from any human-written hint.

## Hypothesis

- **H-174a (Contamination artifact)**: EXP-172's 0% was caused by contamination. With clean env, scout→coder ≥ 80%. Predicted if: scout analysis quality is ≥ moderate hint quality.
- **H-174b (Genuine quality gap)**: Scout→coder remains ~0% even with clean env. The LLM cannot reliably identify the root cause through investigation alone, regardless of environment state.

## Predictions

| H-174a (contamination) | H-174b (quality gap) |
|---|---|
| Pass rate ≥ 80% | Pass rate ≤ 20% |
| Scout analysis names pipeline ordering | Scout analysis misidentifies root cause |

## Design

### Arms

| Arm | Description | N | Scenario |
|-----|-------------|---|----------|
| A | Scout→Coder (clean env) | 15 | `exp172-scout-coder` |

Reference data from EXP-173 (clean):
- Expert F1: 10/10 (100%)
- Moderate hint: 9/9 (100%)
- Base (no hint): 0/11 (0%)

### Environment Verification

**CRITICAL**: Before running, verify exp172-scout-coder/environment is clean:
1. `src/pipeline.js` should show normalize (Step 3) before penalties (Step 4) — this is the bug
2. `src/grades.js` threshold comparison should use `>=` (standard, not a contamination fix)
3. `src/penalties.js` should NOT have a `pct` field added by coder

Status: **VERIFIED** — environment checked 2026-04-16, no contamination present. The exp172-scout-coder scenario was created from clean base and was never modified by coder (git log shows single commit).

### Execution

```bash
export PATH=".state/.bun/bin:$PATH"
# Run 15 trials
for i in $(seq 1 15); do
  bash scripts/gym-run.sh exp172-scout-coder --timeout 600 &
  sleep 2
done
wait
```

Or batch (5 at a time to avoid overload):
```bash
for batch in 1 2 3; do
  for i in $(seq 1 5); do
    bash scripts/gym-run.sh exp172-scout-coder --timeout 600 &
    sleep 2
  done
  wait
done
```

### Success Criteria

Same as cascading-fix-trap-v2: all tests pass, pipeline-order-fixed, no workarounds.

### Analysis Plan

1. **Primary**: Overall pass rate with 95% CI
2. **Secondary**: Compare to EXP-172 (0/15) — is there a significant difference?
3. **Tertiary**: If mixed results, grade scout-generated ROOT_CAUSE_ANALYSIS.md quality — does it identify pipeline ordering?

### Decision Rules

- ≥ 12/15 pass → H-174a confirmed. EXP-172 was contamination artifact. Scout analysis works.
- ≤ 3/15 pass → H-174b confirmed. Genuine quality gap in LLM analysis.
- 4-11/15 pass → Partial effect. Scout analysis helps but is unreliable. Investigate which analyses named root cause.

### Cost

15 trials × 2 phases × ~$0.07 = ~$2.10

---

## Why This Matters

If H-174a is true, it means:
- LLMs CAN generate sufficient analysis through investigation
- The expert-analysis advantage disappears — any analysis (even self-generated) crosses the threshold
- The bottleneck shifts from "analysis quality" to "whether analysis exists at all"
- Two-phase scout→coder workflows become a general solution for hard debugging tasks

If H-174b is true, it means:
- There's a genuine capability gap between "reading an analysis" and "generating one"
- Expert knowledge injection remains necessary for hard tasks
- The recognition threshold model survives (with contamination caveat)

## Tags
`EXP-174` `EXP-172-replication` `contamination` `scout-coder` `cascading-fix-trap-v2`
