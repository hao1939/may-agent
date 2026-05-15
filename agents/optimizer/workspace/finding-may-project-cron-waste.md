# Finding: May Project Cron Still Generating 78% No-Op Sessions

**Date**: 2026-04-28
**Severity**: High (32% of all system sessions are waste)

## Data

- May: 465/1435 total sessions (32.4%)
- Of those, 361 (78%) are no-ops: "0 dispatchable", "0 new items"
- Root cause: `project` cron in `agents/may/cron.json` runs every **5 minutes** (`intervalMs: 300000`)
- 31 items are BLOCKED on Hao — each 5min cycle, May wakes up, scans, finds nothing actionable, exits

## Previous Work

- `experiment-session-waste-reduction` was marked "done" on 2026-04-23
- But the data shows the problem persists: 78% no-op rate unchanged from baseline

## Proposed Fix

**Option A (Quick)**: Increase `project` cron interval from 5min to 30min (match heartbeat interval). This alone would reduce May sessions by ~80%.

**Option B (Better)**: Add a preflight check to the `project` cron that skips if no non-BLOCKED items exist. This makes it event-driven rather than polling.

**Option C (Best)**: Both — longer interval + preflight filter.

## Impact

Reducing May's no-op sessions from ~361 to ~50 would save ~300 sessions worth of compute, reducing total system sessions by ~21%.
