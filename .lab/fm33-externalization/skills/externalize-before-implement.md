# Externalize Before Implementing

Before making ANY code changes, write an ANALYSIS.md file that captures your understanding.

## Required Steps

1. **Read and understand** the problem fully — read all relevant files
2. **Write ANALYSIS.md** with:
   - What the problem is (root cause, not just symptoms)
   - What files need to change and why
   - What "done" looks like — specific verification criteria
   - Edge cases or secondary issues that might exist
3. **Only then** start implementing changes
4. **After implementing**, re-read ANALYSIS.md and verify each criterion is met

## Why This Matters

Externalizing your plan prevents:
- Fixing the wrong thing (misdiagnosis)
- Missing secondary bugs (tunnel vision)
- Claiming success without verifying (FM-3.3)

## Template

```markdown
# Analysis

## Problem
[Root cause description]

## Plan
- [ ] Change 1: [file] — [what and why]
- [ ] Change 2: [file] — [what and why]

## Verification Criteria
- [ ] [Specific check 1]
- [ ] [Specific check 2]

## Edge Cases
- [Anything else to watch for]
```
