# Daily Metrics Snapshot

*Date: 2025-01-20*

## Test Suite Health

| Metric | Value |
|--------|-------|
| **Total Test Files** | 938 |
| **Passed Files** | 734 |
| **Failed Files** | 202 |
| **Skipped Files** | 2 |
| **Total Tests** | 8,697 |
| **Passed Tests** | 8,693 |
| **Failed Tests** | 1 |
| **Skipped Tests** | 1 |
| **Todo Tests** | 2 |
| **Errors** | 6 |
| **Duration** | 29.40s |

## Summary

- **Test pass rate**: 99.95% (8,693 / 8,697)
- **File pass rate**: 78.2% (734 / 938)
- **File failures**: 202 files failed — mostly due to `process.exit` calls in gym scenario test files (escalation-judgment-ext, escalation-judgment-fewshot) causing unhandled rejection errors, not actual test logic failures.

## Regression Guard Status

- Test count (8,697) **well above** 550 threshold ✅
- File count (938) **well above** 90 threshold ✅

## Notes

The 202 file failures and 6 errors are infrastructure issues (gym scenario files calling `process.exit()` which vitest intercepts as errors), not regressions in actual test coverage.
