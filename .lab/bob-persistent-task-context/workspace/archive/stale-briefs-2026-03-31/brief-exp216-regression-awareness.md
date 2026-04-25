# EXP-216: Regression Awareness Skill

**Date**: 2026-03-29
**Status**: DESIGNED
**Hypothesis**: A skill file teaching "grep for callers before editing, run ALL tests after fixing" will improve coder's regression-awareness on the `regression-from-fix` scenario.

## Background

The gym sweep revealed 2 new failures:
- `regression-from-fix` — FAIL (sweep part 3, 2026-03-29)
- `regression-from-fix-workflow` — FAIL (sweep part 3, 2026-03-29)

The scenario tests whether the coder, when fixing a discount bug in `calculateTotal`, checks that dependent functions (`calculateTaxExemptTotal`, `generateInvoice`) still work. The success criteria check:
1. `read-before-edit` — read the source before editing
2. `discount-bug-fixed` — correct the `code` → `discountCode` reference
3. `ran-tests` — ran the test suite
4. `tax-exempt-preserved` — didn't break the tax-exempt function
5. `minimal-fix` — used edit() not write()
6. `all-tests-pass` — all tests pass after fix

This is a **procedural gap** (not judgment-class): the coder can be taught to grep for callers and run full test suites. Unlike `sycophants-dilemma` or `escalation-impossible-task`, this is about process, not model-level judgment.

## Treatment

Lab fork: `agents/.lab/regression-awareness-skill/skills/regression-awareness.md`

The skill teaches:
1. **Map blast radius** — grep for all callers before editing
2. **Minimal fix** — use edit() not write(), change only buggy lines
3. **Full test suite** — run ALL tests, not just bug-related ones
4. **Verify dependents** — if tests don't clearly cover callers, check manually

Positive examples only (lesson from EXP-214: negative examples cause catastrophic regression).

## Protocol

1. **Control**: Run `regression-from-fix` N=5 with baseline coder (no skill)
2. **Treatment**: Run `regression-from-fix` N=5 with skill loaded
3. **Success threshold**: Treatment must pass ≥4/5 runs (≥80% pass rate)
4. **Primary metric**: Overall scenario pass rate (all 6 checks must pass)
5. **Secondary metric**: Individual check pass rates, especially `tax-exempt-preserved` and `all-tests-pass`

## Delegation

Send to Coach:
```
Run gym experiment EXP-216 (regression-awareness skill).
Lab fork: agents/.lab/regression-awareness-skill/
Scenario: regression-from-fix
Control: N=5 baseline runs
Treatment: N=5 with skill agents/.lab/regression-awareness-skill/skills/regression-awareness.md
Report all 6 check results per run.
```

## Risk Assessment

- **Low risk**: This is a procedural skill (grep callers, run tests). Unlike judgment skills, procedural skills have higher success rates (EXP-213 achieved 2x improvement).
- **No negative examples**: Learned from EXP-214 catastrophic regression — only positive examples used.
- **Clear signal**: 6 binary checks give precise failure diagnosis.
