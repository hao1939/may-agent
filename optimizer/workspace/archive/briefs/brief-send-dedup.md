# Design Brief: Send Deduplication & Rate Limiting

**Author**: Optimizer  
**Date**: 2026-03-17  
**Priority**: P1 — Active waste ($5-15/day)  
**Target**: Bob (infra design) → Tech-Lead (implementation)

## Problem

Agents can send unlimited tasks to other agents via `agents.send()`, and each send triggers the target agent's heartbeat via `triggerNow()`. This creates two waste patterns:

### Pattern 1: Send Spam
Bob sent **28 tasks to tech-lead in 6 hours** (4.7/hour). Many are duplicates or re-sends of the same work:
- "Gym Judgment Scenarios" sent 4 times
- "Common Sense Infrastructure" sent 3 times  
- "Verbose Tools" sent 2 times

Each send triggers `triggerNow("heartbeat-tech-lead")`, which fires a new heartbeat session even if the previous one just started working on the same task.

### Pattern 2: Stale Pending Tasks
22 pending sends accumulated with no cleanup. Many were already completed but never marked as COMPLETED. Agents re-send the same task because they don't check if it's already pending.

### Pattern 3: Heartbeat Overtriggering (Residual)  
Despite the `intervalMs/2` cooldown fix, tech-lead still had 7/14 intervals shorter than expected (50% overtriggering). The cooldown blocks some, but 28 sends in 6 hours is enough to push through.

## Quantified Impact

- **Extra heartbeat sessions**: ~3-5/hour for tech-lead alone = ~$2-5/day
- **Wasted cognitive work**: Tech-lead processes the same brief multiple times
- **Cascading sends**: Tech-lead sessions generate more sends to other agents
- **Queue bloat**: 22 pending sends that are never cleaned up → injected into every heartbeat → more prompt tokens

## Proposed Fix

### Fix 1: Dedup Guard in `agents.send()` (JS handler — deterministic)
Before creating a new send request, check if an identical or similar task already exists:

```typescript
// In the send handler:
function isDuplicate(persistDir, toAgent, task) {
  const db = getDb(persistDir);
  const existing = db.query(`
    SELECT task FROM requests 
    WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') 
    AND method = 'send'
  `).all(toAgent);
  
  // Exact match
  for (const r of existing) {
    if (r.task === task) return true;
  }
  
  // Fuzzy match: same first 100 chars (catches re-sends with slight variations)
  const taskPrefix = task.slice(0, 100);
  for (const r of existing) {
    if (r.task?.slice(0, 100) === taskPrefix) return true;
  }
  
  return false;
}
```

If duplicate found → return the existing request ID instead of creating a new one. Do NOT trigger a heartbeat.

### Fix 2: Per-Agent Send Rate Limit
Maximum 3 sends to the same target agent per hour. Beyond that, queue silently (still tracked in DB) but don't trigger heartbeats.

### Fix 3: Heartbeat Cooldown Increase
Change cooldown from `intervalMs / 2` to `intervalMs * 0.75`. For tech-lead (13min interval), this would change from 6.5min to 9.75min — giving the current heartbeat more time to pick up the send before a new one fires.

### Fix 4: Auto-Complete Stale Sends
Add a cleanup sweep (daily JS handler): mark sends older than 24h as `COMPLETED` with summary "auto-expired". Agents should re-send if still needed.

## Implementation Order

1. **Fix 1** (dedup guard) — highest impact, pure JS, deterministic
2. **Fix 3** (cooldown increase) — one-line change in cron.ts
3. **Fix 4** (auto-complete stale) — small JS handler addition
4. **Fix 2** (rate limit) — nice-to-have after 1+3

## Files to Change

- `src/lib/requests.ts` or `src/app/agent-loader.ts` — add dedup check before `trackRequest` in send path
- `src/app/cron.ts` line 148 — change `entry.intervalMs / 2` to `entry.intervalMs * 0.75`
- `agents/may/handlers/` — new or extended handler for stale send cleanup

## Success Metrics

- Tech-lead heartbeat gaps consistently ≥ 13min (no short intervals)
- Pending sends stay < 10 at any time
- No duplicate task text in pending queue
- Bob's sends to tech-lead ≤ 5/hour (down from 4.7/hour → ~2/hour)
