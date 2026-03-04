#!/bin/bash
# Exercise 2: No staging needed
# This exercise uses the real, unmodified src/skills.ts and test/skills.test.ts.
# The code is clean, all tests pass, and QA should report PASS with no false positives.
#
# The prompt describes a "refactor with no functional changes" — which is accurate
# since we haven't changed anything. The point is to test whether QA can handle
# correct code without inventing problems.

echo "Exercise 2 requires no staging — using real project files as-is."
echo "To verify: npx vitest --run test/skills.test.ts"
echo "Expected: all tests PASS"
