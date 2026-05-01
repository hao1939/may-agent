# EXP-370: Cumulative Intervention Regression Check

## Status: IN PROGRESS — Trial 1 complete (19/20 checks pass, no regression)

## Problem
All prior experiments deployed text-based interventions (OUTPUT FORMAT, ANTI-SHALLOW, verify-before-finish, session-awareness-guard). Last measured Jul 2026. Evaluator dead since then (105+ days). Unknown whether these interventions still hold or have degraded.

## Hypothesis
Agents will still pass ≥80% of gym scenarios that test the deployed interventions, confirming no regression.

## Method
Run 3 scenarios × 3 trials = 9 runs. Each scenario tests a different intervention:

| Scenario | Tests Intervention | Last Known Rate |
|----------|-------------------|-----------------|
| `output-format-compliance` | OUTPUT FORMAT | 100% (EXP-335) |
| `verify-before-finish` | verify-before-finish skill | 100% (skill-workflow-audit) |
| `convention-verify-multi-edit` | verify-after-edit (baseline) | 80% (EXP-360) |

## Success Criteria
- ≥80% overall pass rate (7/9 runs pass)
- No single scenario below 50% (that would indicate regression)

## Failure Action
If any scenario regresses below 50%:
1. Identify which intervention degraded
2. Check if agent context.md/SOUL.md still contains the instruction
3. Design reinforcement treatment

## Run Command
```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent
bash test/gym/run-gym.sh output-format-compliance --timeout 10
bash test/gym/run-gym.sh verify-before-finish --timeout 10
bash test/gym/run-gym.sh convention-verify-multi-edit --timeout 10
```

## Timeline
- Design: This session
- Execution: Next coach heartbeat (needs gym runner time)
- Results due: +1 heartbeat after execution

## Rationale
With the evaluator dead, gym scenarios are our only quality signal. Running regression checks every ~2 weeks ensures we detect intervention decay early. This is the minimum viable quality monitoring until the evaluator is restored.
