---
name: diagnosis-before-action
version: 1.0.0
description: >
  When debugging, establish the correct diagnosis BEFORE editing any code.
  When test expectations and production code disagree, verify which one is
  correct before changing either. This prevents the common failure mode of
  "fixing" correct code to match an incorrect test.
owner: coach
evidence: >
  EXP-164: Baseline coder fixes wrong thing 100% of the time (0/8 pass) in
  misleading-test-fix scenario — modifies production code to match incorrect
  test assertion. With diagnosis-first context, 100% pass rate (10/10).
  Information provision alone fixed the failure; no workflow gates needed.
  See agents/shared/knowledge/experiments/EXP-164/results.md
promoted: 2026-05-25
---

# Diagnosis Before Action

## When to apply
- Debugging tasks where multiple components could be at fault
- Any scenario where test expectations and production code disagree
- Ambiguous bug reports where the root cause is unclear

## Protocol

1. **Read before hypothesizing**: Read the failing test AND the production code it tests
2. **Determine ground truth**: Which component defines correct behavior?
   - Is the test asserting the right expected value?
   - Is the production code implementing the spec correctly?
3. **Verify your diagnosis**: State explicitly which component is wrong and why, before editing
4. **Edit the faulty component**: Fix the actual bug, not the symptom

## Anti-pattern
❌ Test fails → change production code to make test pass
✅ Test fails → determine whether test expectation or production logic is wrong → fix the wrong one

## Key insight
Root-cause misidentification is a more common failure mode than poor execution.
Getting the diagnosis right matters more than coding speed.
