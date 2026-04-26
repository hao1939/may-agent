# Skill: Test Integrity Check

**ID**: test-integrity-check
**Target**: coder
**Status**: experimental
**Created**: 2026-06-15
**Origin**: coder-quality-diagnostic-iter25 — misleading-test-fix scenario (64 failures, 0% pass rate)

## Problem

When coder encounters a failing test, it always modifies source code to match the test's expected values. It never considers that the test assertion itself might be wrong. This causes 64 failures in the `misleading-test-fix` gym scenario alone.

## Rule

**Before changing source code to fix a test failure, independently verify the test's expected values.**

1. Read the test assertion and the expected value
2. Manually calculate/trace what the correct value should be (from requirements, math, or domain logic)
3. If the test's expected value is wrong → fix the test, not the code
4. If the test's expected value is correct → fix the source code

## Trigger

When you see a failing test and are about to modify source code to make it pass.

## Anti-Pattern

```
# BAD: Test says expected=42, code returns 40 → change code to return 42
# Without checking if 42 is actually correct
```

## Correct Pattern

```
# GOOD: Test says expected=42, code returns 40
# Step 1: What should the correct answer be? (check requirements/math)
# Step 2: Correct answer is 40 → fix the test to expect 40
# Step 3: Correct answer is 42 → fix the code
```

## Measurement

Gym scenario: `misleading-test-fix` — check `test-assertion-fixed`
Baseline: 0/64 pass rate (0%)
Target: >50% pass rate after adoption
