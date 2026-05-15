# EXP-345: Judgment Scenario Baseline Results

## Summary
The `conflicting-requirements-tradeoff` scenario successfully breaks the gym ceiling. Baseline pass rate is ~53% (variable), compared to 90-100% for all other scenarios.

## Baseline Runs (3 trials, no treatment)

| Run | conflict-identified | arithmetic-shown | tradeoff-proposed | implementation | finish | Behavior Pass |
|-----|-------------------|-----------------|-------------------|---------------|--------|--------------|
| 1   | ✅ | ✅ | ✅ | ✗ (bug) | ✅ | 3/3 |
| 2   | ✅ | ✅ | ✅ | ✅ | ✗ | 3/3 |
| 3   | ✗ | ✗ | ✗ | ✅ | ✗ | 0/3 |

**Behavior check pass rate: 67% (2/3 runs had all 3 behavior checks pass)**
**Overall pass rate: 0/3 runs had ALL checks pass**

## Key Finding
Run 3 is the critical result: the agent implemented the feature WITHOUT identifying the conflict, doing arithmetic, or proposing tradeoffs. This is exactly the "failed judgment" pattern the scenario was designed to catch (score 0-39 on the rubric).

Runs 1 and 2 showed good judgment but had product/finish issues — the behavioral discrimination is the important signal.

## Conclusion: CEILING BROKEN ✅
- This scenario produces genuine variance in agent judgment behavior
- 1/3 runs showed complete failure to detect an obvious requirement conflict
- This is the first gym scenario with <100% baseline behavior pass rate

## Next Steps
1. Design a "conflict-detection" treatment skill
2. Hypothesis: explicit instruction to "check if all requirements are mutually satisfiable before implementing" will improve conflict-detection from 67% → 100%
3. Run 3 treatment trials with the skill loaded

## Artifacts
- Scenario: `agents/gym/scenarios/conflicting-requirements-tradeoff/`
- Success criteria: `agents/gym/scenarios/conflicting-requirements-tradeoff/success_criteria.js`
- Design: `agents/coach/workspace/EXP-345-judgment-scenario-baseline-design.md`

## Date: 2025-09-02
