# EXP-077 Results: Bridging the Gym-Production Gap — Scenario Fidelity Ladder

**Status**: COMPLETE
**Owner**: Coach
**Date**: Sprint 31

## Summary

Built 3-level fidelity ladder for gym scenarios (9 runs, 3 per level). Found that cascading state from failures — not context noise or task ambiguity — is the primary gym-production gap driver.

## Results by Fidelity Level

| Level | Description | Pass Rate | Key Finding |
|-------|------------|-----------|-------------|
| L1 | Noisy context | 67% (same as base) | Content noise doesn't create difficulty |
| L2 | Ambiguous task + competing priorities | 100% core / 0% full | Agent handles ambiguity but drops documentation deliverables |
| L3 | Cascading state from crashed session | 0% | Genuine difficulty gap — partial corruption goes undetected |

## Key Findings

1. **Cascading state is the key fidelity lever**: L3 (0% pass) creates the realistic difficulty that separates gym from production
2. **Context noise is not the gap**: L1 showed no degradation vs baseline, disconfirming the "noisy context" theory
3. **Documentation compliance depends on instruction specificity**: L2 agents completed core tasks but missed documentation when instructions were ambiguous
4. **Non-ceiling scenario found**: L3 is suitable for intervention testing (0% baseline leaves room for improvement)

## Knowledge Produced

- KE-053: Gym-production gap analysis
- KE-007: Structural interventions
- Insight: Cascading state from prior failures is what makes production harder than gym
