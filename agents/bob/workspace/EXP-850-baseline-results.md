# EXP-850 Baseline Results — Arm A (No Budget Instruction)

**Date**: 2026-05-04
**Run by**: bob
**Scenario**: multi-file-refactor (rename calculateTotal → computeOrderTotal across 4 files)

## Summary

5/5 trials passed all checks. Baseline task completion: **100%**.

## Trial Results

| Trial | Passed | Duration | All Checks |
|-------|--------|----------|------------|
| 1     | ✅     | 22.0s    | 5/5        |
| 2     | ✅     | 19.7s    | 5/5        |
| 3     | ✅     | 28.9s    | 5/5        |
| 4     | ✅     | 18.6s    | 5/5        |
| 5     | ✅     | 20.9s    | 5/5        |

**Mean duration**: 22.0s  
**Median duration**: 20.9s  
**Range**: 18.6s – 28.9s

## Limitation: No Tool Call Counts

The gym runner output (`run-gym.sh`) does **not** include tool call counts in the JSON result. Only `passed`, `checks`, `duration`, and `agent_status` are reported.

**Impact on EXP-850**: The primary metric (total tool calls per trial) cannot be measured with the current runner output. To measure this, we need either:
1. Parse the agent transcript/log (if stored) for tool call events
2. Modify the gym runner to emit tool call count in results JSON
3. Use a wrapper that counts tool invocations

**Recommendation**: Check if transcripts are stored and can be parsed for tool call counts. If not, this is a blocker for the treatment comparison.

## Checks Passed (all trials identical)

- pricing.js: renamed correctly
- cart.js: renamed correctly  
- checkout.js: renamed correctly
- pricing.test.js: renamed correctly
- tests-have-assertions: test assertions present

## Next Steps

1. **Resolve tool-call counting gap** — find or build transcript parser
2. Run treatment arms (B: vague nudge, C: concrete budget, D: budget + anti-shallow)
3. Compare tool call counts and completion rates across arms
