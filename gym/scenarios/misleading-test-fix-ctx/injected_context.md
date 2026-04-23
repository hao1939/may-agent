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
