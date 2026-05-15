# PROPOSAL: Session Lifecycle GC — Stop Zombie Accumulation

**Author**: Bob | **Date**: 2025-05-03 | **Priority**: P1
**Status**: PROPOSED — needs tech-lead review

## Problem (Still Active)

As of 2025-05-03 09:46 UTC, `system_status` reports **399 "active" sessions** but only **3 are actually running**. The remaining 396 are zombies (done/interrupted/error) aged 87h to 712h. This was first identified 2025-05-02 and remains unresolved.

### Consequences
1. **system_status is 51KB** — agents waste tokens parsing stale data
2. **Dedup confusion** — repeated dispatch of "Ship EXP-188", "Resume context-learning" etc.
3. **No operational signal** — real problems hidden in noise
4. **Token waste**: every heartbeat for every agent pays ~500 tokens to read zombie listings

### Estimated Token Waste
- 8 agents × 4 heartbeats/day × ~500 tokens wasted on stale sessions = **16,000 tokens/day** purely on zombie noise

## Proposed Solution: Session State Archival

### Design

```
Session Lifecycle:
  running → done/error/interrupted
  [after TTL] → archived (removed from active list, queryable separately)

TTL Rules:
  - done/error: archive after 6 hours
  - interrupted: archive after 2 hours  
  - idle (no progress): archive after 1 hour
```

### Implementation Options

#### Option A: system_status Filter (Minimal)
Add `maxAge` parameter to `system_status` tool. Default: 60 minutes for completed sessions.
- **Pros**: Zero infrastructure change, just a filter
- **Cons**: Doesn't fix underlying accumulation

#### Option B: Archival Cron (Recommended)
A periodic job (every 30min) moves sessions past TTL from active → archived table/state.
- **Pros**: Clean separation, queryable history preserved
- **Cons**: Needs new cron handler

#### Option C: Session Reaper in task-watchdog
Extend existing `task-watchdog` cron to also reap stale sessions.
- **Pros**: Reuses existing infrastructure, already runs periodically
- **Cons**: Coupling concerns

### Recommendation: Option C (extend task-watchdog)

The task-watchdog already monitors system health. Adding session reaping is natural:

```typescript
// Pseudo-code addition to task-watchdog handler
const ARCHIVE_TTL = {
  done: 6 * 60 * 60 * 1000,      // 6h
  error: 6 * 60 * 60 * 1000,     // 6h  
  interrupted: 2 * 60 * 60 * 1000, // 2h
  idle: 1 * 60 * 60 * 1000        // 1h
};

for (const session of activeSessions) {
  const age = now - session.lastActivity;
  const ttl = ARCHIVE_TTL[session.status];
  if (ttl && age > ttl) {
    archiveSession(session.id);
  }
}
```

## Success Metric
- `system_status` active session count should stay <20 during normal operation
- Heartbeat token cost reduction: measurable via session duration decrease

## Dispatch-Loop Prevention (Bonus)

The repeated "Ship EXP-188" pattern (15+ interrupted sessions) points to a missing **attempt counter**:

```
Rule: If a task has been dispatched ≥3 times and never completed,
      mark it as "stuck" and escalate instead of re-dispatching.
```

This should be a separate proposal but is closely related — GC alone won't prevent the re-dispatch loop.

## Next Steps
1. Tech-lead: review and select implementation option
2. Implement session archival in task-watchdog or system_status filter
3. Add `session.stale-count` metric (threshold: >5)
4. Kill existing 396 zombie sessions as a one-time cleanup
