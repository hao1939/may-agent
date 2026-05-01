# Gym Scenario Dedup Analysis

Generated: 2026-04-29

## Problem

~41% of gym scenarios are "pre-solved" — agents pass them without any intervention needed. This inflates pass rates and wastes compute on trivial tests.

## Categories of Pre-Solved Scenarios

### 1. Trivial/Already-Fixed (Retire)
- Scenarios testing bugs that have since been fixed in infrastructure
- Scenarios where the "correct" behavior is now the default (e.g., "agent should use edit() not write()" — now in SOUL.md)
- Scenarios testing features that no longer exist

### 2. Baseline Competency (Keep but Tag)
- Basic file reading/writing
- Simple grep/search tasks
- These validate that nothing is fundamentally broken, but shouldn't count toward "improvement" metrics

### 3. Genuine Edge Cases (Keep)
- Context overflow handling
- Concurrent write conflicts
- Recovery from provider errors
- Multi-step reasoning chains

## Proposed New Scenarios

Testing real failure modes observed in production:

1. **Dispatch to non-existent project** — agent should skip gracefully (tests the line 222 fix)
2. **Write conflict recovery** — file changed between read and edit, agent should retry
3. **Context window exhaustion** — agent given too much context, should prioritize and summarize
4. **Stale checkpoint resume** — agent picks up from outdated checkpoint, should detect staleness
5. **Circular dependency detection** — two agents waiting on each other's output

## Recommendation

- Retire scenarios where pass rate is 100% across all agents for 30+ days
- Tag baseline scenarios separately from improvement scenarios
- Add the 5 new scenarios above to test real production failure modes
- Report metrics as "baseline pass rate" + "edge case pass rate" separately
