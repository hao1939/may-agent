# Proposal: Fix feedback-echo-sync Handler Degradation

**Date:** 2026-06-05
**Author:** arc
**Priority:** P1
**Triggered by:** may → arc message (P1 investigation-request)

## Problem

The `feedback-echo-sync` cron handler (runs hourly via `agents/may/cron.json`) shows
a clear performance degradation trend. Measured completion times over the last 24h:

| Time (UTC) | Duration |
|------------|----------|
| 23:19 | 23s |
| 00:20 | 82s |
| 01:20 | 34s |
| 02:22 | 66s |
| 03:23 | 46s |
| 04:24 | 27s |
| 05:27 | 64s |
| 06:29 | 91s |
| 07:30 | 46s |
| 08:33 | 79s |
| 09:36 | 114s |
| 10:36 | 85s |
| 11:38 | 51s |
| 12:41 | 52s |
| 13:45 | **160s** |
| 14:47 | 75s |
| 15:51 | 84s |
| 16:55 | 124s |
| 17:55 | 140s |
| 19:57 | **251s** |

Peak is now 251s (4+ minutes). The 5h moving average has roughly tripled.

## Root Cause

`agents/shared/feedback-echo.ts` runs these queries for each of 12 agents:

1. **Per-agent latest eval** (line 44): `SELECT sessionId, quality, verdict, issues, createdAt FROM evaluations WHERE agent = ? AND issues IS NOT NULL AND issues != '[]' ORDER BY createdAt DESC LIMIT 1`
   - Uses `idx_eval_agent_ts` index → fast ✓

2. **Per-agent recent distinct issues** (line 57): `SELECT DISTINCT issues FROM evaluations WHERE agent = ? AND issues IS NOT NULL AND issues != '[]' ORDER BY createdAt DESC LIMIT 5`
   - DISTINCT on a TEXT column with JSON blobs, 9,463 rows with issues ≠ '[]' total
   - Index covers (agent, createdAt) but NOT `issues` → requires full row reads for dedup
   - ×12 agents = the dominant cost

3. **All agents discovery** (line 105): `SELECT DISTINCT agent FROM evaluations WHERE issues IS NOT NULL AND issues != '[]'`
   - Scans all 15,353 rows; no time bound

The evaluations table grows ~125 rows/day (9,463 with issues in lifetime, 912 in 7d). As it grows linearly, scan cost grows linearly. The DB retention policy (approved 2026-06-04) covers events >7d and sessions >14d but does **not** cover the evaluations table.

## Fix (3 options, recommend Option A)

### Option A: Time-bound the queries (minimal change, highest ROI)

Replace the three slow queries with time-bounded versions:

```typescript
// Line 57: Add WHERE createdAt > (now - 7 days)
const recentRows = db.query<{ issues: string }, [string, number]>(
  `SELECT DISTINCT issues FROM evaluations 
   WHERE agent = ? AND issues IS NOT NULL AND issues != '[]' 
     AND createdAt > ?
   ORDER BY createdAt DESC LIMIT 5`
).all(agent, Date.now() - 7 * 86400000);

// Line 105: Add WHERE createdAt > (now - 7 days)
const agents = db.query<{ agent: string }, [number]>(
  `SELECT DISTINCT agent FROM evaluations 
   WHERE issues IS NOT NULL AND issues != '[]'
     AND createdAt > ?`
).all(Date.now() - 7 * 86400000);
```

This caps the scan to ~912 rows (7d) instead of 9,463+ (lifetime). Expected duration: <10s.

### Option B: Add evaluations to retention policy

Add `DELETE FROM evaluations WHERE createdAt < strftime('%s','now')*1000 - 604800000` to the daily retention handler. This permanently caps table size.

**Downside:** Destroys historical evaluation data that could be useful for trend analysis.

### Option C: Both A and B

Time-bound the queries AND add evaluations >30d to retention. Best of both worlds — queries are fast regardless, and table doesn't grow unbounded.

## Recommendation

**Option A** is the immediate fix. It's a 2-line change in `feedback-echo.ts`, requires no schema migration, and brings the handler back under 10s.

Option C should be considered separately as part of the broader DB retention policy implementation.

## Impact

- Removes feedback-echo-sync as a contributor to the handler p95 duration metric (currently 123s, target 120s)
- Prevents eventual timeout failures as the evaluations table grows
- No behavioral change — the handler only uses the last 5 distinct issues per agent anyway

## Files to Change

- `agents/shared/feedback-echo.ts` — lines 57 and 105 (add `AND createdAt > ?` clauses)
