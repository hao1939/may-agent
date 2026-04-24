# Context Patch for tech-lead FM-3.3 Fix

## Change Description
Add to tech-lead's context.md:

```
- FM-3.3 prevention: For ALL bug-fix delegation tasks, use the verified-coder workflow (not raw agents.call). Include a verifyCommand that runs the relevant test. Never trust coder's claim that tests pass — the workflow runs the command itself and loops on failure.
- After ANY direct file edit (not delegated), run verification yourself: tsc --noEmit + relevant test file. Do NOT call finish() until you have exit code 0 from a verification command in your own session.
```

## Rationale
15 FM-3.3 errors in 7 days. Root causes:
1. Coder claims verification passed but doesn't actually run commands (10 errors)
2. Tech-lead claims tests pass without structural evidence (4 errors)  
3. Tech-lead skips post-write verification (1 error)

The verified-coder workflow prevents #1 by running verification externally.
The direct-edit rule prevents #2 and #3.

## Test Scenario
partial-verification-trap: baseline 5/6 → workflow variant 6/6 (2/2 runs each)

## Fork Type
context.md environmental knowledge (not SOUL.md text coaching)
