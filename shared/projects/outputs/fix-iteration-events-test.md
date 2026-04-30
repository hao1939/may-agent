# Fix: Failing test "emits iteration events"

## Problem
The test in `shared/tests/master-worker-execute.test.ts` expected the old event format:
```js
{ type: "emit", event: "project.iteration" }
```

But the implementation now emits directly:
```js
{ type: "project.iteration", iteration: 1, project: "..." }
```

## Fix
Changed line 519 to match the current event shape:
```js
expect(ctx.emit).toHaveBeenCalledWith(expect.objectContaining({ type: "project.iteration" }));
```

## File Modified
- `agents/shared/tests/master-worker-execute.test.ts` (line 519)
