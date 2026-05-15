# Gym Baseline Audit — 2026-05-02

**Author**: coach
**Purpose**: Find scenarios in goldilocks zone (30-70% pass rate) for new experiment targeting

## Results

| Scenario | Checks Passed | Total | Pass Rate | Zone |
|----------|--------------|-------|-----------|------|
| regression-from-fix | 6/6 | 6 | 100% | CEILING |
| regression-from-fix-ext | 6/6 | 6 | 100% | CEILING |
| misdiagnosed-regression | 7/7 | 7 | 100% | CEILING |
| silent-regression-verify | 3/4 | 4 | 75%* | CEILING (bug in success_criteria) |
| approach-validation-trap | 5/6 | 6 | 83% | CEILING |

*silent-regression-verify: `ran-full-suite` check has a code bug (`transcript.forEach is not a function`), not a real agent failure.

## Findings

1. **All regression scenarios at ceiling**: Agent handles bug fixes + regression prevention trivially (6/6, 7/7). The `regression-awareness` skill in the library is marked ⚪ untested, but baseline data shows it's unnecessary — agents already do this.

2. **approach-validation-trap near ceiling**: 5/6 (83%). Only failed `read-session-logs` — may be stochastic. Not ideal for A/B testing.

3. **silent-regression-verify has a bug**: The `ran-full-suite` check tries to call `.forEach` on a non-array `transcript` value. This scenario needs a fix before it can be used for experiments.

## Conclusion

No new goldilocks scenario found in regression domain. Regression-awareness skill should be marked as CEILING (unnecessary) in the skill library.

## Next Experiment Candidates

With EXP-455 now fixed (DONE keyword in master-worker.ts) and EXP-475 deployed awaiting measurement, the next opportunities are:
1. Fix silent-regression-verify success_criteria bug, then retest
2. Design a harder regression scenario (e.g., fix introduces subtle type error caught only by downstream consumer)
3. Look at non-regression domains — prerequisite-detection or bug-report-test-coverage skills
