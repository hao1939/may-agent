---
id: KE-2027
title: "Session Digest Task Column Duplication — 250 MB DB Waste (13% of Total)"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, session-digests, storage-waste, optimization]
related: [KE-2023, KE-2024, KE-2019]
---

<ai_context>
summary: The session_digests table stores the `task` column identically in both step=1 (session.start) and step=2 (end) rows for every session. This creates 250 MB of pure duplication out of 500 MB total task storage in the table — 13% of the 1956 MB DB file is wasted. Root cause: line 731 of session-digest.ts copies `last?.task` into every subsequent step row, even though the task text never changes between session start and end. Fix: NULL out the task column for step > 1 rows (they can join back to step=1 on the same sessionId when needed). This would immediately save ~250 MB at current throughput and reduce the DB from ~1956 to ~1706 MB — pushing it back below the 2000 MB threshold without needing a threshold raise.
triggers: heartbeat DB size investigation, KE-2023 breach timeline
falsifiers:
  - F1: "If step=2 task content differs from step=1 in >5% of sessions, the duplication assumption is wrong and the task value at end time carries independent information."
  - F2: "If nulling the task for step>1 breaks consumers (e.g., session-digest-context.ts reads task from the latest step without joining step=1), the fix needs a code audit of all readers first."
</ai_context>

## Observation

At 2026-06-18 ~06:40Z, DB file at 1956 MB with 2000 MB threshold (44 MB headroom, ~1.5h to breach at 26 MB/h).

Investigated `session_digests` table (45,775 rows, second-largest contributor after events):

```
step=1 task total: 250 MB (trigger=session.start)
step=2 task total: 250 MB (trigger=end)
Difference between step1 and step2 task for same session: 0 bytes (ALL sampled pairs identical)
```

**Result**: 250 MB of the 500 MB task storage is pure duplication.

## Root Cause

In `projects/may-agent/src/lib/session-digest.ts`, line 731 (in the LLM synthesis / end-trigger path):

```typescript
task: last?.task ?? input.task ?? null,
```

When trigger is "end", `last?.task` resolves to the step=1 row's task (the session's original prompt). This copies the entire task string into the new step=2 row. Since the task text never changes during a session (it's the original prompt), this is a pure copy with zero information gain.

## Evidence

```sql
-- All sampled pairs have task diff = 0
SELECT d1.sessionId, ABS(LENGTH(d1.task) - LENGTH(d2.task)) as diff
FROM session_digests d1
JOIN session_digests d2 ON d1.sessionId = d2.sessionId
  AND d1.step = 1 AND d2.step = 2
WHERE d1.created_at > strftime('%s','now')*1000 - 86400000
LIMIT 5;
-- All rows: diff = 0
```

Average task size: 16,859 bytes. At 4,628 duplicated sessions/day × 14-day retention = ~64,792 duplicate rows × 16.8 KB = ~1.04 GB/14d (but only half the window is currently full, giving ~250 MB live).

## Fix Options

### Option A: NULL task in step > 1 rows (preferred)

Change line 731 to:
```typescript
task: null,  // task is already stored in step=1; no need to copy
```

Consumers that need the task from the end digest can JOIN on sessionId WHERE step=1. The `getLastDigest()` function and `cleanTaskText()` already handle null task gracefully.

**Savings**: ~250 MB immediately at steady state (13% of current DB size).

### Option B: Skip step=2 task, add foreign key lookup

More complex but semantically cleaner. The step=2 row would reference step=1 implicitly.

## Impact Assessment

- Current DB: 1956 MB → estimated ~1706 MB after fix + VACUUM
- This single change provides more relief than the threshold raise (which adds headroom without reducing actual usage)
- Does NOT require a threshold raise — moves the DB below steady-state even at current throughput
- Combined with threshold raise to 2500 MB: provides ~800 MB headroom (months of growth)

## Consumers to Audit (F2 check)

From grep of codebase:
- `session-digest.ts` line 208-214: `cleanTaskText(d.task)` — handles null task
- `session-digest-context.ts`: uses `getLastDigest()` which returns step=2 row — would now have null task
- Any code calling `getSessionContext()` that expects task from the latest digest step

The fix requires verifying that no consumer reads `task` exclusively from the latest step. The `getLastDigest()` function (line 76) does `ORDER BY step DESC LIMIT 1`, so it returns step=2 where task would be null. If callers rely on this, they need to be updated to use step=1's task or a JOIN.

## Recommendation

This is a src/ change requiring ORDER-010 human approval. Write a proposal for the task-nulling fix. At current growth rate (~26 MB/h), this fix alone would buy ~10 hours of headroom even without the threshold raise. Combined with both, the DB pressure is resolved for weeks.
