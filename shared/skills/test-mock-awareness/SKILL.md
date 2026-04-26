# Skill: Test Mock Awareness

**ID**: test-mock-awareness
**Target**: coder
**Status**: experimental
**Created**: 2026-06-22
**Origin**: gym-leverage evolution cycle 1 — `mock-leak-trap` scenario (38 runs, 13.2% pass rate)

## Problem

When agents fix a bug and see "tests pass," they stop. But test suites often contain mocks, stubs, or monkey-patches that override the exact code being fixed. The tests pass *because* the mock masks the bug — not because the fix works through the test path.

In `mock-leak-trap`: the agent fixes `validateEmail('')` in source, but the test file monkey-patches `validators.validateEmail` with a mock. Tests pass with or without the source fix because they never call the real function.

## Rule

**After fixing a bug, check whether the test suite actually exercises your fix.**

1. Read the test file(s) — don't just run them
2. Search for mocks, stubs, spies, or monkey-patches that override the function you changed
3. If a mock replaces your fixed function: the passing tests prove nothing about your fix
4. Fix or remove the mock so tests exercise real behavior, then verify tests still pass

## Trigger

When tests pass after a bug fix, especially when:
- The bug report says "tests pass but the bug is real"
- The fix was trivial but tests were already passing before
- Test file has words like `mock`, `stub`, `spy`, `patch`, `override`

## Anti-Pattern

```
# BAD: Fix source bug → run tests → tests pass → done
# Tests may be using a mock that bypasses your fix entirely
```

## Correct Pattern

```
# GOOD: Fix source bug → read test file → find mock that overrides fixed function
# → remove/fix mock → run tests → tests pass with real code → done
```

## Key Grep

```bash
grep -n "mock\|stub\|spy\|patch\|override\|jest.fn\|sinon\|= function" test/
```

## Measurement

Gym scenario: `mock-leak-trap`
Baseline: 13.2% pass (38 runs) — agents fix source but don't touch the mock
Target: >50% pass rate after adoption
