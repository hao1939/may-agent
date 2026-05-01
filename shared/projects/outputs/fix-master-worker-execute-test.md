# Fix: master-worker-execute.test.ts failing test

## Problem
The test "rejects when project.md does not exist" expected `ctx.escalate` to be called with "No project.md", but the `execute` function was refactored to return `{ status: "skipped", reason: "project-not-found" }` instead.

## Fix
Updated the test assertion at line 151 from:
```ts
expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("No project.md"));
```
To:
```ts
expect(result).toEqual(expect.objectContaining({ status: "skipped", reason: "project-not-found" }));
```

## Verification
All 24 tests in `shared/tests/master-worker-execute.test.ts` pass.

## File Modified
- `agents/shared/tests/master-worker-execute.test.ts` (line 151)
