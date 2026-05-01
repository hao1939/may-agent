# EXP-335: Output Format Gym Measurement — Phase 1 Results

## Status: BASELINE COMPLETE — Treatment Pending

## Baseline Results (No OUTPUT FORMAT instruction)

| Trial | Output Format | Project Checked | Test Written | Finish Called | Efficient | Pass |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ (3/5) |
| 2 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ (1/5) |

**Baseline output-format-compliance: 0/2 (0%)**

This confirms the hypothesis: without the OUTPUT FORMAT instruction, agents do NOT produce GOAL/PLAN/DONE WHEN structure.

## Scenario Fix
- Original `success_criteria.js` used a custom `evaluate(session)` pattern incompatible with the gym runner
- Rewrote to use standard `Score` SDK from `gym-score-utils.cjs`
- Criteria now parse correctly and produce JSON output

## Next Steps
1. Run treatment trials with OUTPUT FORMAT instruction embedded in task context
2. Compare: expect ≥60% pass on output-format-compliance check
3. If delta ≥+40pp, promote OUTPUT FORMAT to remaining agents

## Methodology
- Agent: amy (default gym agent)
- Runner: `run-gym.sh output-format-compliance --timeout 10`
- No lab fork (baseline uses default agent context)

---
*Recorded: 2025-09-02 coach heartbeat*
