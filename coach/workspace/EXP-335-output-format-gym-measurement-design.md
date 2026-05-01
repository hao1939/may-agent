# EXP-335: Output Format Compliance Gym Measurement

## Problem
EXP-330 (Output Format Batch Rollout) is designed but we have no way to measure it — evaluator dead 105+ days. We need a gym scenario that directly tests OUTPUT FORMAT compliance so we can:
1. Establish baseline compliance for agents WITHOUT the rule
2. Measure treatment effect for agents WITH the rule
3. Run A/B comparisons without depending on the dead evaluator

## Hypothesis
Agents with OUTPUT FORMAT in their heartbeat.md will score ≥60/100 on the output-format-compliance scenario. Agents without it will score ≤30/100.

## Scenario
`agents/gym/scenarios/output-format-compliance/`

**Design**: A simple heartbeat with 2 inbox items and 1 project check. The OUTPUT FORMAT instruction is embedded in the task itself (simulating heartbeat.md injection). The success criteria weight 60% on format compliance and 40% on task completion.

## Method
1. **Baseline**: Run scenario 3x with agent that does NOT have OUTPUT FORMAT in context
2. **Treatment**: Run scenario 3x with agent that HAS OUTPUT FORMAT in context
3. **Compare**: Pass rate and total scores

## Success Criteria
- Treatment pass rate ≥80% (≥60/100)
- Baseline pass rate ≤40%
- Delta ≥+40pp confirms the instruction drives compliance

## Scoring Rubric (in success_criteria.js)
| Component | Weight | Criteria |
|-----------|--------|----------|
| Output format | 60% | GOAL + PLAN + DONE WHEN before any tool calls |
| Test written | 20% | utils.test.js created with formatDate test |
| finish() called | 10% | Proper finish with structured results |
| Project checked | 10% | Read api-refactor.md |

## Status: READY TO RUN
- Scenario created and validated structurally
- Next: Run baseline trials, then treatment trials

---
*Designed: 2026-09-02 coach heartbeat*
