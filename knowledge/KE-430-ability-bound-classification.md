# KE-430: Ability-Bound vs Process-Bound Task Classification

## Finding
Tasks where agents fail due to insufficient coding ability (ability-bound) cannot be improved by any process/planning skill. Four experiments on `partial-verification-trap` confirm this:

| Experiment | Skill Tested | Result |
|-----------|-------------|--------|
| EXP-261 | Procedural bug-fix prompting | 6% (NEGATIVE) |
| EXP-265 | Compound verification | 0% (NEGATIVE) |
| EXP-420 | Decompose-before-acting | 0% (NEGATIVE) |
| EXP-430 | Test-first debugging | 0% (NEGATIVE) |

## Diagnostic Criteria
A task is **ability-bound** when:
1. The agent consistently reaches the right step (e.g., runs tests, identifies the bug location)
2. But produces incorrect implementation (wrong logic, wrong fix)
3. Process variations (test-first, decompose, step-by-step) don't change the outcome

A task is **process-bound** when:
1. The agent has the ability to complete each sub-step correctly
2. But fails due to skipping steps, missing constraints, or wrong ordering
3. Process skills show measurable improvement (e.g., decompose-before-acting +33pp on hidden-constraints-refactor)

## Implication
Before testing any skill on a scenario, classify whether baseline failures are ability-bound or process-bound. Only invest in process-skill experiments on process-bound scenarios.

## Evidence
- EXP-415: +33pp on hidden-constraints-refactor (process-bound) ✓
- EXP-430: 0pp on partial-verification-trap (ability-bound) ✗

## Date
2025-09-14
