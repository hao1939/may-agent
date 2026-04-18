---
hypothesis_id: H-082
title: Adversary Role Reduces Silent Failures in Multi-Agent Systems
date: 2026-04-06
status: "MERGED into H-001 — Resolved"
source_papers: [arXiv:2604.03201]
source_posts: [HB-250406-scrat-memory-control-verify]
---

# H-082: Adversary Role Reduces Silent Failures

## Hypothesis

Adding an explicit **adversary/critic role** to our proposer/executor/validator pattern (making it proposer/executor/validator/adversary) will reduce correlated errors and silent failures by 30%+ in complex multi-step tasks.

## Rationale

From SCRAT paper (arXiv:2604.03201):
> "role-differentiated proposer/executor/checker/adversary systems may reduce correlated error under asymmetric information and verification burden"

Current gap in our system:
- Proposer: suggests approach
- Executor: implements
- Validator: checks output
- Missing: **Adversary** actively tries to break/find edge cases

## Mechanism

The adversary role would:
1. Review the complete trajectory after execution
2. Actively search for edge cases, unstated assumptions, failure modes
3. Challenge the validator's assessment (adversarial verification)
4. Report "attack vectors" that could break the solution

## Success Metrics

- Reduction in silent failures (errors not caught by validator)
- Increased robustness on edge cases
- No significant increase in latency (<20% overhead)

## Test Approach

1. Select 20 complex multi-step tasks from gym
2. Run with current 3-role pattern (baseline)
3. Run with 4-role pattern (adversary added)
4. Inject 10% adversarial test cases (subtle errors)
5. Measure detection rate and false positive rate

## Kill Conditions

- Adversary introduces >30% false positives
- Total latency increases >50%
- No measurable improvement in error detection

## Related

- H-060: Declarative skill auto-evolution
- H-067: Budgeted forgetting for memory
- SYNTHESIS-002: Multi-agent coordination foundations

## Notes

This aligns with our existing pattern but adds an explicit "red team" perspective. The adversary doesn't need to run on every request—could be sampled or triggered by complexity heuristics.
