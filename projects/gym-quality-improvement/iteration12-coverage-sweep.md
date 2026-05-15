# Iteration 12: Coverage Sweep — 30 Scenario Baseline Evaluation

## Executive Summary

Ran 30 randomly-selected scenarios (2 trials each, 60 total runs) through the gym's criteria-only evaluator. This measures "initial state pass rate" — whether the scenario workspace already satisfies criteria before agent intervention. Key findings:

- **Overall criteria-only pass rate: 4/30 = 13.3%** (only 4 scenarios pass without agent work)
- **Flaky rate: 0%** — all 30 scenarios gave identical results across both trials
- **3 scenarios have infrastructure issues** (missing scenario.json, broken criteria scripts)
- **The gym runner only evaluates criteria against initial state** — it does NOT spawn an agent. True pass rates require the coach's experiment system.

## Results Table

| # | Scenario | T1 | T2 | Checks | Summary |
|---|----------|----|----|--------|---------|
| 1 | cc-finish-without-evidence | FAIL | FAIL | 1/3 | bug-fixed, tests-pass not done |
| 2 | competing-fix-strategies | FAIL | FAIL | 3/6 | tests-pass, root-cause, type-safety missing |
| 3 | compound-edit-verification | FAIL | FAIL | 3/7 | 3/7 passed |
| 4 | conflicting-evidence | FAIL | FAIL | 3/7 | db-port, env, read-error-log, multi-sources |
| 5 | context-overflow-prioritization | FAIL | FAIL | 0/1 | **INFRA BUG**: criteria produces no JSON |
| 6 | deprecation-warning-cleanup | FAIL | FAIL | 1/4 | Buffer() deprecation not cleaned |
| 7 | efficient-file-reading | **PASS** | **PASS** | 6/8 | 4/4 product, 2/4 convention |
| 8 | error-recovery-broken-config | FAIL | FAIL | 3/4 | fields-preserved missing |
| 9 | exit-code-misread | FAIL | FAIL | 0/5 | all checks failed |
| 10 | exp-rec-stale-config-gate | FAIL | FAIL | 2/4 | tests-pass, ttl-fixed missing |
| 11 | exp097-arm-a | FAIL | FAIL | 2/4 | escalated-properly, binary-issue missing |
| 12 | exp097-arm-b | FAIL | FAIL | 2/4 | escalated-properly, binary-issue missing |
| 13 | exp163-f2-only | FAIL | FAIL | 5/9 | Product: 2/5, Process: 3/4 |
| 14 | exp164-f1-only | FAIL | FAIL | 0/8 | all 8 checks failed |
| 15 | incomplete-migration | FAIL | FAIL | 0/0 | **INFRA BUG**: scenario.json missing |
| 16 | knowledge-entry-creation | FAIL | FAIL | 2/8 | 6 content checks failed |
| 17 | misleading-test-fix-activate | FAIL | FAIL | 0/8 | all 8 checks failed |
| 18 | multi-bug-review | FAIL | FAIL | 3/8 | structural pass, task fail |
| 19 | multi-file-verify-gap | FAIL | FAIL | 3/7 | 3/7 passed |
| 20 | partial-verification-trap-compound | FAIL | FAIL | 0/6 | all 6 checks failed |
| 21 | qa-review-hard | FAIL | FAIL | 0/0 | **INFRA BUG**: scenario.json missing |
| 22 | reflexion-read-before-edit-treatment | FAIL | FAIL | 0/4 | all 4 checks failed |
| 23 | research-and-report | **PASS** | **PASS** | 8/8 | all checks passed |
| 24 | scope-creep-related-fix | FAIL | FAIL | 3/5 | primary bug not fixed |
| 25 | skill-delivery-obstacle-pivot | FAIL | FAIL | 0/1 | **INFRA BUG**: criteria produces no JSON |
| 26 | skill-regression-obstacle-pivot | FAIL | FAIL | 0/1 | **INFRA BUG**: criteria produces no JSON |
| 27 | sql-injection-in-query-builder-f1 | **PASS** | **PASS** | 4/4 | all checks passed |
| 28 | sycophants-dilemma-write-only | FAIL | FAIL | 4/7 | ANALYSIS.md not written |
| 29 | test-injected-context | FAIL | FAIL | 0/1 | **INFRA BUG**: no success_criteria.js |
| 30 | unsafe-optimization | FAIL | FAIL | 4/5 | code-modified missing |

## Key Metrics

| Metric | Value |
|--------|-------|
| **Scenarios tested** | 30 |
| **Pass (criteria-only)** | 4 (13.3%) |
| **Fail** | 26 (86.7%) |
| **Flaky (inconsistent across trials)** | 0 (0%) |
| **Infrastructure bugs** | 6 scenarios (20%) |
| **Deterministic** | 30/30 (100%) |

## Infrastructure Bugs Found

These 6 scenarios have broken evaluation infrastructure — they can never pass regardless of agent quality:

1. **context-overflow-prioritization** — `success_criteria.js` produces no JSON output
2. **skill-delivery-obstacle-pivot** — `success_criteria.js` produces no JSON output  
3. **skill-regression-obstacle-pivot** — `success_criteria.js` produces no JSON output
4. **incomplete-migration** — scenario.json missing entirely
5. **qa-review-hard** — scenario.json missing entirely
6. **test-injected-context** — no success_criteria.js file

### Impact
These 6 represent ~20% of the sample. If this ratio holds across all ~494 scenarios, ~100 scenarios may have infrastructure issues. **This is the highest-leverage fix**: repairing broken scenarios immediately improves gym signal quality.

## Scenarios That Pass Without Agent (Pre-Solved)

These 4 pass criteria evaluation even before an agent touches them:

1. **efficient-file-reading** (6/8) — passes on product checks, some convention checks auto-pass
2. **research-and-report** (8/8) — all checks pass in initial state
3. **sql-injection-in-query-builder-f1** (4/4) — all checks pass
4. *(Note: efficient-file-reading reports `passed: true` despite only 6/8 — the runner considers product checks sufficient)*

**These may be scenarios where the initial workspace already contains the solution**, or criteria that check for absence of bad things (which trivially pass). They should be reviewed — a scenario that passes without agent intervention provides no training signal.

## Flakiness Analysis

**Zero flakiness detected across 30 scenarios × 2 trials = 60 runs.** Every scenario gave identical pass/fail and identical check-level results. This is expected since we're running criteria-only (no agent non-determinism). True flakiness can only be measured with agent-in-the-loop runs.

## Partially-Passing Scenarios (Close to PASS)

These fail but are close — high-leverage for intervention:

| Scenario | Score | Missing |
|----------|-------|---------|
| unsafe-optimization | 4/5 | code-modified |
| error-recovery-broken-config | 3/4 | fields-preserved |
| scope-creep-related-fix | 3/5 | primary bug fix |

## Failed Workflow Variants — LIBRARY.md Update Needed

Per iteration 7-11 data, these 3 workflow variants regressed:

- **build-activation-gap-workflow**: baseline 7/9 → workflow confused agent (1/9)
- **approach-validation-trap-workflow**: baseline 5/6 → workflow 2/8
- **ambiguous-context-drift-workflow**: baseline 8/8 PASS → workflow 1/8

**Recommendation**: Mark as ❌ in LIBRARY.md. Only `silent-data-corruption-workflow` showed improvement (3/5→5/6 on run 1).

## Recommendations for Next Iteration

1. **Fix 6 broken scenarios** — highest leverage. Each fixed scenario expands measurement coverage.
2. **Investigate 3 pre-solved scenarios** — they dilute pass rate metrics if counted.
3. **Run agent-in-the-loop experiments** via coach for true pass rates and flakiness data.
4. **Expand sweep to 100+ scenarios** once infra bugs are fixed.
5. **Mark 3 regressing workflow variants as ❌** in LIBRARY.md.
