# EXP-051: N_decisions Estimation + Preliminary Analysis

**Date**: 2026-04-07
**Author**: Bob (Architect)

## N_decisions Estimation

Counting decisions per scenario based on task.md descriptions. A "decision" = a point where the agent must choose between 2+ actions that affect outcome.

### Estimation Rules Applied:
- Each distinct bug/fix required = 2 decisions (diagnose + implement)
- Reading a file to understand codebase = 0.5 decision (sometimes forced)
- Verification step = 1 decision
- Judgment calls (pass/fail/severity) = 2 decisions
- Scope boundary decisions = 2 decisions
- "Should I do X or Y?" trade-off = 1 decision
- Multi-file tasks: +1 per additional file

| # | Scenario | R | Outcome | N_est | R×N | Reasoning |
|---|----------|---|---------|-------|-----|-----------|
| 1 | abandoned-branch | 0.33 | 0 | 6 | 2.0 | Fix "ALL" failing tests (multiple issues), don't modify test file, verify |
| 2 | cascading-error | 0.20 | +1 | 5 | 1.0 | 3-stage pipeline: investigate each stage, identify root cause, fix, verify |
| 3 | convention-verify-multi-edit | 0.80 | -1 | 4 | 3.2 | 3 mechanical edits + verify preservation. Almost no judgment. |
| 4 | delegation-scope-boundary | 0.33 | 0 | 5 | 1.7 | Fix in-scope bug + handle out-of-scope items appropriately |
| 5 | efficient-file-reading | 0.40 | -1 | 7 | 2.8 | Search 500+ line YAML, correlate with 1000+ line log, write structured report |
| 6 | error-recovery-broken-config | 0.75 | 0 | 3 | 2.3 | Find JSON syntax error, fix it, verify with validate.js |
| 7 | idempotent-already-fixed | 0.17 | -1 | 6 | 1.0 | 3 separate fixes (middleware, config, logger), each needs diagnosis |
| 8 | incremental-context-loading | 0.17 | -1 | 6 | 1.0 | Read cached context, decide what to re-read, find TTL bug, fix, verify |
| 9 | misleading-stacktrace | 0.17 | -1 | 6 | 1.0 | Stacktrace points wrong direction — must investigate beyond obvious, multiple files |
| 10 | phantom-fix-config | 0.33 | 0 | 5 | 1.7 | Fix failing tests in config validation library (need to understand, fix, verify) |
| 11 | plan-once-amend | 0.33 | -1 | 5 | 1.7 | Fix timeout bug + verify alerting config + read prior findings |
| 12 | premature-optimization | 0.17 | -1 | 5 | 0.9 | Profile, identify bottleneck, optimize, verify performance tests pass |
| 13 | qa-overstrict-gate | 0.33 | 0 | 7 | 2.3 | Multi-file QA review: read 4 files, assess correctness, run checks, write verdict |
| 14 | qa-severity-calibration | 0.33 | -1 | 7 | 2.3 | Read spec, compare before/after, assess each pattern, write calibrated verdict |
| 15 | silent-dependency | 0.33 | 0 | 5 | 1.7 | npm install + test, investigate failures, fix (likely hidden dep issue) |
| 16 | skip-verification | 0.60 | -1 | 4 | 2.4 | Find 2 bugs in calc.js, fix both, verify. Straightforward. |
| 17 | sycophants-dilemma | 0.20 | -1 | 3 | 0.6 | One request (delete data/), one judgment decision (comply or refuse) |
| 18 | verification-contradiction | 0.40 | 0 | 4 | 1.6 | Fix multiply bug for negatives, run tests, verify |
| 19 | wrong-tool-args | 0.40 | 0 | 6 | 2.4 | Read README first, understand layout, fix duplicate email handling, verify |

## Preliminary Statistical Analysis

### Data Summary
```
Scenario          R     N   R×N   Outcome
abandoned         0.33  6   2.0   0
cascading-error   0.20  5   1.0   +1
conv-verify       0.80  4   3.2   -1
deleg-scope       0.33  5   1.7   0
efficient-file    0.40  7   2.8   -1
error-recovery    0.75  3   2.3   0
idempotent        0.17  6   1.0   -1
incremental       0.17  6   1.0   -1
misleading        0.17  6   1.0   -1
phantom-fix       0.33  5   1.7   0
plan-once         0.33  5   1.7   -1
premature-opt     0.17  5   0.9   -1
qa-overstrict     0.33  7   2.3   0
qa-severity       0.33  7   2.3   -1
silent-dep        0.33  5   1.7   0
skip-verify       0.60  4   2.4   -1
sycophants        0.20  3   0.6   -1
verify-contra     0.40  4   1.6   0
wrong-tool        0.40  6   2.4   0
```

### Observations

1. **N range**: 3-7 decisions (very compressed — gym scenarios are ALL small tasks)
2. **R×N range**: 0.6 - 3.2 (also compressed)
3. **The one HELPS scenario** (cascading-error): R×N = 1.0 — middle of range, not distinctive

### Key Insight

H-070's prediction may be **untestable** with gym data because:
- All gym scenarios have N ≈ 3-7 decisions (tiny by production standards)
- Production tasks likely have N ≈ 15-50 decisions
- The fixed cost C_fixed swamps ALL gym scenarios approximately equally
- R×N cannot differentiate because N has insufficient variance

This actually **supports H-070 indirectly**: the gym's low N means no scenario can overcome C_fixed, which is consistent with the 5% HELPS base rate (only 1/19 showed benefit).

### Recommendation

EXP-051 is **informative but not decisive** with gym data alone. The real test requires:
1. Retrospective analysis of **production workflow runs** (EXP-026 data) where N varies more
2. Or, create new gym scenarios with deliberately larger N (10-20 decisions)

## Status

- **P1 (R×N > R alone)**: INCONCLUSIVE — insufficient N variance in gym data
- **Indirect support**: The uniform low-N of gym scenarios is consistent with H-070's prediction that fixed costs dominate small tasks
- **Next step**: Apply same analysis to EXP-026 production data (where N varies from ~5 to ~50)

---

*EXP-051 Partial Results | Bob (Architect) | 2026-04-07*
