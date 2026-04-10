# EXP-127 Execution Protocol

**Experiment**: Channel Separation Direct Test
**Date**: 2026-04-10
**Status**: READY TO EXECUTE

## Prerequisites

- [x] Baseline scenario exists: `contradictory-requirements`
- [x] Channel 3 scenario created: `contradictory-requirements-ch3-fewshot`
- [x] Channel 1 lab fork created: `coder-channel-test-ch1`
- [x] Channel 2 scenario exists: `contradictory-requirements-ext`
- [x] Content verified identical between Channel 1 skill and Channel 3 injected_context

## Content Verification

The core guidance text is identical between:
- `agents/.lab/coder-channel-test-ch1/skills/contradiction-detection.md` (Channel 1, lines 3+)
- `agents/gym/scenarios/contradictory-requirements-ch3-fewshot/injected_context.md` (Channel 3)

Diff confirmed: 0 differences in worked example content.

## Execution Commands

### Step 0: Verify Scenario Loads
```bash
scripts/gym-run.sh --list --tag channel-test 2>&1
# Should show contradictory-requirements-ch3-fewshot
```

### Step 1: Baseline (6 runs)
```bash
for i in $(seq 1 6); do
  echo "=== Baseline Run $i ==="
  scripts/gym-run.sh contradictory-requirements --agent coder --timeout 5 2>&1 | tail -20
  echo ""
done
```

### Step 2: Arm A — Channel 1 / System Prompt (6 runs)
```bash
for i in $(seq 1 6); do
  echo "=== Ch1 Run $i ==="
  scripts/gym-run.sh contradictory-requirements --agent coder --lab coder-channel-test-ch1 --timeout 5 2>&1 | tail -20
  echo ""
done
```

### Step 3: Arm B — Channel 3 / Task Message Few-Shot (6 runs)
```bash
for i in $(seq 1 6); do
  echo "=== Ch3 Run $i ==="
  scripts/gym-run.sh contradictory-requirements-ch3-fewshot --agent coder --timeout 5 2>&1 | tail -20
  echo ""
done
```

### Step 4: Arm C — Channel 2 / Forced Externalization (6 runs)
```bash
for i in $(seq 1 6); do
  echo "=== Ch2 Run $i ==="
  scripts/gym-run.sh contradictory-requirements-ext --agent coder --timeout 5 2>&1 | tail -20
  echo ""
done
```

### Step 5: Analysis
1. Tabulate pass/fail for all 24 runs
2. Compute per-arm pass rate with 95% CI
3. Fisher's exact test for A vs B (the key test)
4. Score detailed checks (not just overall pass/fail)
5. Write results.md

## Expected Results (H-098 Predictions)

| Arm | Channel | Predicted Pass Rate | 95% CI |
|-----|---------|--------------------:|--------|
| Baseline | None | 0% (0/6) | [0%, 39%] |
| A (Ch1) | System Prompt | 0-17% (0-1/6) | [0%, 48%] |
| B (Ch3) | Task Message | 83-100% (5-6/6) | [52%, 100%] |
| C (Ch2) | Forced Ext. | 83-100% (5-6/6) | [52%, 100%] |

## Abort Criteria

- If baseline shows ≥3/6 (50%+), STOP — scenario may have drifted from 0% floor
- If Arm A shows ≥4/6, STOP and verify lab fork is loading correctly (the skill may be appearing in task context, not system prompt)
- If all arms show 0%, STOP after 3 runs per arm — no channel differentiation possible

## Notes

- N=6 per arm gives 80% power to detect a 67% difference at p<0.05 (Fisher's exact)
- The A vs B comparison is the key discriminator: same content, different channel
- Historical data: Baseline 0/19 (0%), Ch2 4/4 (100%), Ch3-similar 1/3 (33%)
