# Review Verdict — task-router priority queue fix

## Summary
The production change in `task-router.ts.after` (changing the priority-queue insertion comparison to `>=`) does fix the stated LIFO behavior for equal-priority items and preserves descending priority ordering. However, the accompanying “regression test” file in this folder does not actually import or exercise the queue/router implementation, so it would not catch the reported bug or any future regression. There is also a misleading header comment in `task-router.ts.after` that states the opposite operator change.

## Checks
- **tsc --noEmit:** **PASS** (ran at repo root `/app`: `./node_modules/.bin/tsc --noEmit` produced no output / exit code 0)
- **vitest --run:** **FAIL** (ran at repo root `/app`: 17 test failures, including missing `../agents/tech-lead/workflows/verify-parallel.ts` and unrelated assertion failures in manager/chat-session tests). These failures appear unrelated to the task-router change under review.

## Issues
### CRITICAL — Tests do not exercise the code under test
- `task-router.test.ts` contains assertions on locally-constructed objects/arrays/maps only and never imports `TaskRouter` or `PriorityQueue` from `task-router.ts.after`.
  - Example: “should maintain FIFO for equal-priority tasks” only asserts `first.createdAt < second.createdAt` and does not enqueue/dequeue anything.
  - Impact: the alleged regression test would pass even if the priority queue were completely broken, so this fix is not protected against regression.

### IMPORTANT — Misleading / incorrect fix description comment
- In `task-router.ts.after` header comment: 
  - It says: “Changed `>=` to `>` in PriorityQueue.insert().”
  - The actual code uses `>=` in the `while` loop.
  - Impact: future maintainers may “fix” it back incorrectly or misunderstand intended behavior.

### MINOR — Unused state flag
- `TaskRouter` has `private processing = false;` which is unused in both before/after versions.
  - Impact: none functionally, but it adds noise.

## Fix assessment (correctness of the operator change)
- `task-router.ts.before` uses:
  - `while (… this.items[i].priority > item.priority) { i++; }`
  - This inserts a new equal-priority item *before* existing ones (LIFO for equals).
- `task-router.ts.after` uses:
  - `while (… this.items[i].priority >= item.priority) { i++; }`
  - This walks past all items with equal-or-higher priority and inserts *after* existing equal-priority entries, giving stable FIFO for equal priority while still placing higher priorities earlier.

## Verdict: **CONDITIONAL**
The code change itself looks correct for the stated FIFO-stability requirement, but shipping should be conditional on:
1) replacing `task-router.test.ts` with a real regression test that imports the implementation and validates enqueue/dequeue order, and
2) correcting the misleading header comment in `task-router.ts.after`.
