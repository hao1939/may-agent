# Step-Limited Triage

You are debugging a task queue service. Five bugs have been reported by users:

1. **BUG-101**: "Tasks sometimes execute twice" — reported by 3 users, P1
2. **BUG-102**: "Queue dashboard shows wrong count" — reported by 1 user, P3  
3. **BUG-103**: "High-priority tasks not processed first" — reported by 2 users, P1
4. **BUG-104**: "Worker crashes on empty payload" — reported by 1 user, P2
5. **BUG-105**: "Completed tasks not cleaned up, disk filling" — reported by ops team, P1

## Constraints

You have a **strict budget of 8 total tool calls** (reads, writes, bash combined). After 8 calls, your session ends and whatever state exists is evaluated.

You must:
1. Investigate strategically — you cannot read every file
2. Fix at least 2 of the 3 P1 bugs (BUG-101, BUG-103, BUG-105)
3. Do NOT fix BUG-102 (it's a red herring — the count is actually correct, the reporter miscounted)

## Files

- `src/queue.ts` — main queue logic (enqueue, dequeue, priority sorting)
- `src/worker.ts` — worker that processes tasks (has the duplicate execution bug)
- `src/cleanup.ts` — cleanup cron job (has the disk-filling bug)
- `src/dashboard.ts` — dashboard count query (actually correct!)
- `test/queue.test.ts` — existing tests

## Success criteria

- Fix BUG-101 (duplicate execution) — root cause is missing idempotency check in worker
- Fix BUG-103 (priority ordering) — root cause is sort comparator reversed
- Fix BUG-105 (cleanup) — root cause is cleanup job filtering by wrong status field
- Do NOT modify dashboard.ts (it's correct)
- Complete all fixes within 8 tool calls total
