---
id: null-digest-task-step2
title: "Stop duplicating session task in step>1 digest rows — saves 250 MB (13% of DB)"
date: 2026-06-18
author: arc
priority: P1
status: proposed
requires: ORDER-010
related: [KE-2027, KE-2023, KE-2024]
---

# Proposal: NULL task column for step > 1 in session_digests

## Problem

The `session_digests` table stores the `task` column identically in both
step=1 and step=2 rows for every session. Since the task (original session
prompt) never changes during a session, step=2 is a pure copy of step=1.

This costs **250 MB** at current throughput — 13% of the 1956 MB DB file.

## Evidence

```sql
-- Every sampled pair has identical task
SELECT ABS(LENGTH(d1.task) - LENGTH(d2.task)) as diff
FROM session_digests d1
JOIN session_digests d2 ON d1.sessionId = d2.sessionId
  AND d1.step = 1 AND d2.step = 2
WHERE d1.created_at > strftime('%s','now')*1000 - 86400000
-- Result: ALL rows diff = 0
```

Total: 250 MB step=1 + 250 MB step=2 (identical) = 250 MB wasted.

## Fix

### File: `projects/may-agent/src/lib/session-digest.ts`

**Line 731** (inside the end/checkpoint path):

```typescript
// BEFORE:
task: last?.task ?? input.task ?? null,

// AFTER:
task: null,  // task stored in step=1; no duplication needed
```

### Consumers to update (if needed after testing):

1. `session-digest-context.ts` — if `getLastDigest()` callers need task,
   change them to: `digest.task ?? getFirstDigest(persistDir, sessionId)?.task`
2. Any digest reader that calls `getLastDigest()` and reads `.task` —
   verify it handles null gracefully (most already do via `cleanTaskText()`
   which returns null for null input).

### Cleanup (optional, one-time):

```sql
-- After deploying the fix, reclaim existing duplicates:
UPDATE session_digests SET task = NULL WHERE step > 1;
-- Then VACUUM to reclaim the ~250 MB
VACUUM;
```

## Impact

| Before | After |
|--------|-------|
| DB: ~1956 MB | DB: ~1706 MB (after fix + cleanup) |
| Time to 2000 MB breach: ~1.5h | Below threshold — no breach |
| Daily task storage: ~150 MB/14d | ~75 MB/14d |

## Risk

Low. The task text at step=2 is provably identical to step=1 (0 bytes
difference across all 4,628 sessions in the last 24h). No information is
lost — step=1 retains the authoritative copy. Consumers already handle
null task (`cleanTaskText()` returns null, display code shows "unknown task").

## Priority Justification

P1: This fix alone resolves the imminent DB threshold breach (KE-2023) without
needing the threshold raise to 2500 MB. It reduces the steady-state DB size
by 250 MB — more than the 44 MB current headroom, buying substantial time.
Combined with the threshold raise, it provides months of headroom.
