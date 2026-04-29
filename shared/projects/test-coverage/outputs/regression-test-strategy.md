# Regression Test Strategy

## Overview
Strategy for maintaining test reliability as the codebase evolves, balancing thoroughness with execution speed.

## Test Suite Tiers

### Tier 1: Smoke Tests (every commit)
- **Scope**: Core agent lifecycle — startup, task receipt, execution, completion
- **Runtime target**: < 30 seconds
- **Tests**: 10-15 critical path assertions
- **On failure**: Block merge

### Tier 2: Integration Tests (every PR)
- **Scope**: Cross-agent workflows, DB operations, file I/O
- **Runtime target**: < 5 minutes
- **Tests**: 50-80 integration scenarios
- **On failure**: Block merge, notify author

### Tier 3: Full Regression (nightly)
- **Scope**: All tests including edge cases, performance benchmarks
- **Runtime target**: < 30 minutes
- **Tests**: 200+ full suite
- **On failure**: Create issue, notify team

## Incremental vs Full Suite Decision

| Trigger | Suite |
|---------|-------|
| Single file change | Tier 1 + affected Tier 2 |
| Multi-file change | Tier 1 + Tier 2 |
| Dependency update | Full Tier 3 |
| Release candidate | Full Tier 3 + manual smoke |
| Config/env change | Tier 2 + Tier 3 |

## Flaky Test Handling

1. **Detection**: Test fails on retry but passes on re-run → flagged as flaky
2. **Quarantine**: Move to `flaky/` directory after 3 flaky occurrences in 7 days
3. **Root cause**: Assign investigation within 48h — common causes:
   - Timing/race conditions → add explicit waits or synchronization
   - External dependencies → mock or stub
   - State leakage → improve test isolation
4. **Resolution**: Fix and move back to main suite, or delete if low value
5. **Budget**: Max 5% of suite can be quarantined at any time

## Test Prioritization

When time-constrained, run tests in this order:
1. Tests covering recently changed code (git diff analysis)
2. Tests that have failed in the last 7 days
3. Tests covering high-traffic code paths
4. Tests covering error handling paths
5. Edge case and boundary tests

## Metrics to Track
- **Suite pass rate**: Target 98%+ (excluding quarantined)
- **Flaky rate**: Target < 2%
- **Mean time to detect regression**: Target < 15 minutes
- **Test execution time trend**: Should not grow > 10%/month
