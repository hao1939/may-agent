# Bug Fix: Zombie Sessions Stuck in "running" Status

**Found by**: Optimizer (2026-03-25)
**File**: `src/lib/manager.ts`, function `cleanupZombieSessions()` (line ~1246)
**Impact**: 15+ zombie sessions accumulating with status="running", 0 ops, stale >30min

## Root Cause

`cleanupZombieSessions()` only archives sessions with terminal statuses (`interrupted`, `done`, `error`).
Sessions that crash or get orphaned while still in `running` status are never cleaned up because:
1. They're not in `activeSessions` (no in-memory session exists)
2. Their meta.json still says `status: "running"`
3. The cleanup function skips them since "running" is not in `terminalStatuses`

## Evidence

```
Zombie sessions (running >30min): 15
  bob s_1774413297486_0... 175min stale, 0 ops - echo hello
  bob s_1774413463236_0... 172min stale, 0 ops - echo hello
  ...
```

All have 0 ops, all "echo hello" type — these are oneshot sessions that crashed/timed out.

## Proposed Fix

In `cleanupZombieSessions()` (src/lib/manager.ts ~line 1246):

```typescript
// BEFORE (current):
if (terminalStatuses.has(meta.status)) {
  try {
    archiveSession(persistDir, sessionId);
    archived++;
  } catch { /* best-effort */ }
}

// AFTER (fixed):
if (terminalStatuses.has(meta.status)) {
  try {
    archiveSession(persistDir, sessionId);
    archived++;
  } catch { /* best-effort */ }
} else if (meta.status === "running") {
  // Orphaned session: still "running" but not active in memory.
  // Check if stale (>30min since last activity).
  const staleThresholdMs = 30 * 60 * 1000;
  const lastActivity = meta.updatedAt ?? meta.startedAt ?? 0;
  if (Date.now() - lastActivity > staleThresholdMs) {
    try {
      // Mark as interrupted before archiving
      writeSessionMeta(persistDir, sessionId, { ...meta, status: "interrupted" });
      archiveSession(persistDir, sessionId);
      archived++;
    } catch { /* best-effort */ }
  }
}
```

## Also update DB

The sessions table in may.db also has these zombie entries. The cleanup should also update the DB:

```sql
UPDATE sessions SET status = 'interrupted' 
WHERE status = 'running' AND (strftime('%s','now')*1000 - startedAt) > 1800000
```

## Testing

1. Verify `writeSessionMeta` and `readSessionMeta` signatures accept the proposed usage
2. Check if there's a `updateSessionStatus` or similar helper
3. Unit test: create a mock session dir with running status, old timestamp, call cleanupZombieSessions, verify it gets archived
