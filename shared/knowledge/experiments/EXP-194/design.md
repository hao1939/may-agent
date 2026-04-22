# EXP-194: Bug-Type Classification Study (H-181 P-181a)

**Hypothesis:** H-181 (Relational Bug Blindness)
**Status:** DESIGNED
**Created:** 2026-04-22
**Cost:** $0 (retrospective analysis only)

## Goal

Test P-181a: Do relational-bug scenarios have systematically lower base rates than value-bug scenarios?

## Method

### Phase 1: Classify Scenarios by Bug Type

Select ~20 core bug-fixing scenarios from the gym (excluding variants/arms). For each, read the scenario environment and classify the primary bug as:

- **VALUE**: Fix requires changing a specific value, operator, constant, or variable name. The bug is in a single line/expression. Examples: wrong operator (`>` vs `>=`), wrong variable, wrong constant.
- **RELATIONAL**: Fix requires changing relationships between components — ordering, data flow, dependency structure. No single line is "wrong"; the arrangement is wrong. Examples: pipeline ordering, wrong function called, missing dependency chain.
- **MIXED**: Both value and relational bugs present.
- **OTHER**: Judgment/behavioral scenarios, not bug-fixing.

### Phase 2: Correlate with Base Rates

Pull base rates from existing experiment results and baseline files. Compare:
- Mean base rate for VALUE scenarios
- Mean base rate for RELATIONAL scenarios
- Effect size (Cohen's d or similar)

### Scenarios to Classify (core set, ~20)

From the gym portfolio, prioritize scenarios that:
1. Are primarily bug-fixing tasks
2. Have known base rates (from experiments or baselines)
3. Are base variants (not experimental arms)

Key candidates:
- `cascading-fix-trap-v2` (known: has both value + relational bugs)
- `sql-injection-in-query-builder` (value: wrong query construction)
- `hidden-dependency` / `hidden-dependency-ext`
- `misleading-test-fix`
- `wrong-fix-recovery`
- `regression-from-fix`
- `stale-config-override`
- `mock-leak-trap`
- `silent-data-corruption`
- `type-mismatch-silent-coercion`
- `cascading-error`
- `ghost-dependency-debug`
- `partial-config-migration`
- `error-recovery-broken-config`
- `copy-paste-vuln`
- `red-herring-investigation`
- `multi-bug-pivot`
- `hasty-fix`
- `phantom-fix`
- `misdiagnosed-regression`

### Phase 3: Report

Write classification table + correlation analysis. If P-181a holds (significant base-rate gap), propose structural intervention experiment (EXP-195+).

## Success Criteria

- ≥15 scenarios classified with bug type
- ≥10 scenarios with known base rates for correlation
- Clear statistical comparison (even if N is small, report effect size)
- Classification rationale documented per scenario

## Predictions

- **P-181a CONFIRMED** if: relational-bug scenarios have mean base rate ≤50% of value-bug scenarios
- **P-181a REFUTED** if: relational-bug scenarios have mean base rate ≥80% of value-bug scenarios
- **INCONCLUSIVE** if: between 50-80%, or too few scenarios in one category

## Files to Read

- Scenario environments: `agents/gym/scenarios/<name>/environment/`
- Baseline results: `agents/gym/scenarios/RECOGNITION-BASELINE-RESULTS.md`, `RECOGNITION-GAPFILL-BASELINE-RESULTS.md`
- EXP-177 results for cascading-fix-trap-v2 data
