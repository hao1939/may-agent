# Design: Cron State Persistence

## Problem

The cron system had no persistent state. On restart:

1. **Every job timer started from zero.** A 6h job that ran 5h59m ago would wait
   another random-jitter + 6h = potentially 12h. A 6h job that ran 1 minute ago
   would fire again after random jitter (could be seconds).

2. **In-flight jobs were forgotten.** Overlap protection was purely in-memory
   (Maps/Sets). Detached process PIDs were lost.

3. **History was append-only JSONL.** 11,872 lines, never compacted.

Evidence: May's heartbeat had 2,315/3,027 runs at <25% of its expected 10-min
interval. Coach heartbeat: 292/960. Caused by restarts resetting all timers.

## Solution

Track each cron job execution as a **request** in the existing `requests` table
(`.state/may.db`). No new tables, no new database file.

### How It Works

Each cron fire creates a request with:
- `fromEntity = "cron"` — identifies it as a cron-triggered execution
- `toAgent` — which agent runs the job
- `artifact` — the cron entry name (e.g., `"heartbeat-coach"`, `"training-sprint"`)
- `context` — JSON with `type` ("heartbeat"/"handler"/"detached") and `pid` for detached jobs
- Standard `status` lifecycle: `CREATED` → `IN_PROGRESS` → `COMPLETED`/`FAILED`

### Resume Logic

On startup, for each enabled entry:

```
row = SELECT MAX(createdAt) FROM requests WHERE artifact = entry.name

if no rows:
    delay = random(0, entry.intervalMs)  // never ran — jitter

else if orphaned running request exists:
    for detached: check PID alive → if dead, mark FAILED, fire immediately
    for in-process: mark FAILED (process died), fire immediately

else:
    elapsed = now - last_fire_time
    if elapsed >= entry.intervalMs: delay = 0  // overdue
    else: delay = entry.intervalMs - elapsed   // resume correctly
```

### Overlap Protection

**Cron timer** (automatic): Checks for active requests before firing:
```sql
SELECT 1 FROM requests
WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')
```
If found, the timer skips that cycle.

**Manual triggers** (`triggerNow`): Always fire regardless of overlap.
Only debounced by cooldown (half the interval, min 60s).

For heartbeats, overlap is checked per-agent (not per-entry) — if any heartbeat
for agent X is running, no new heartbeat for agent X starts.

For detached jobs, the PID is verified with `process.kill(pid, 0)`. If the
process died but the request is still active, it's marked FAILED (orphan cleanup).

### What This Replaced

- `job-history.jsonl` — unbounded append-only log → now rows in `requests` table
- `JobResult` type — removed, results are `RequestRecord`
- `cron_state` / `cron_history` tables — never needed, `requests` covers both
- In-memory `heartbeatRunning`, `handlerRunning`, `detachedRunning` Sets/Maps
- In-memory `pendingTriggers`, `retriggerCounts`, `lastTriggerTime` (dead code)

### What This Fixes

1. **Correct resume** — jobs fire based on when they last ran, not from zero
2. **No double-fires after restart** — eliminates the 2,315 wasted May sessions
3. **Orphan detection** — detached PIDs checked on startup
4. **Unified tracking** — cron jobs visible alongside all other requests
5. **No new schema** — reuses existing `requests` table infrastructure
