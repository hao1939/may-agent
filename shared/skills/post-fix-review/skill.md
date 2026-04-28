# Skill: Post-Fix Review

📘 **After tests pass on a bug fix, STOP and re-read every file you modified. Look for secondary issues: naming inconsistencies, config mismatches, hardcoded values, error message accuracy. Only then proceed to finish().**

## When to Apply
- Bug-fix tasks where you changed code to make tests pass
- Any task where the obvious fix might mask a secondary issue

## Evidence
- EXP-263: +40pp recognition rate (60% → 100%, N=20)
- KE-412: Post-Fix Review Guard

## Anti-pattern: BLIND FIX
Agents optimize for test-pass and stop. 40% of the time, there are secondary bugs in the same files you just edited that you won't notice unless you explicitly re-read.
