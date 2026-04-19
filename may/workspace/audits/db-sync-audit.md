# DB Sync Accuracy Audit — Session opCount

**Date**: 2026-04-13  
**Investigator**: May  
**Scope**: Accuracy of `sessions.opCount` in `.state/may.db` vs filesystem `meta.json`

---

## Executive Summary

The `sessions.opCount` field in `may.db` is inaccurate for **54% of all terminal sessions** (10,803 of 20,137). The problem has three distinct root causes with different severity levels. The most impactful issue is **historical** (pre-tracking data) and cannot be fixed retroactively.

## Finding 1: Running Sessions Show 0 Ops in DB Until session-sync Fires

**Severity**: Medium (stale data window)  
**Affected**: All currently running sessions

### Mechanism
1. `DbWriter` (event subscriber) writes `opCount=0` on `session_start` event
2. During session execution, `manager-receipts.ts` increments `session.opCount` in memory and writes it to `meta.json` on each state-changing tool call
3. `DbWriter` only updates DB opCount on `session_end` — there is NO incremental DB update during session execution
4. `session-sync` handler (cron, every 5 min) reads `meta.json` and does `INSERT OR REPLACE` into DB, which syncs the real-time opCount from filesystem → DB

### Impact
- Between session start and first session-sync cycle (up to 5 min), DB shows `opCount=0` for active sessions
- After session-sync fires, DB closely tracks meta.json (typically within 1-2 ops behind since meta.json updates per-tool-call)
- **Observed gap**: At audit start, 7 running sessions all showed `opCount=0` in DB. After ~3 minutes, session-sync fired and updated them to correct values (7-41 ops)

### Evidence
```
Before session-sync:
s_1776059535175_8 (may): DB=0, meta.json=5
s_1776059497429_6 (tech-lead): DB=0, meta.json=6
s_1776059497373_5 (scout): DB=0, meta.json=15

After session-sync (~3 min later):
s_1776059535175_8 (may): DB=33, meta.json=34
s_1776059588245_11 (tech-lead): DB=37, meta.json=41
s_1776059497373_5 (scout): DB=36, meta.json=41
```

## Finding 2: Read-Only Sessions Have Genuinely 0 Ops

**Severity**: Low (data is correct)  
**Affected**: ~1,270 verification/read-only workflow steps

### Mechanism
- `opCount` only increments for **state-changing** tool calls (write, edit, bash)
- `read()` calls do NOT increment opCount
- Workflow verification phases (Phase 3 in D-o-R pattern) are explicitly READ-ONLY
- These sessions genuinely performed 0 state-changing operations
- Their `meta.json` files have no `opCount` field at all (it's never written because `manager-receipts.ts` only writes opCount to meta.json when incrementing)

### Evidence
```
s_1776056100837_16 (optimizer): VERIFICATION TASK (READ-ONLY)
  meta.json: no opCount field
  DB: opCount=0
  Evaluation: quality=1, productiveCalls=0 ← genuinely did 0 writes

s_1776056475384_19 (bob): Phase 3 VERIFY (READ-ONLY)
  meta.json: no opCount field  
  DB: opCount=0
```

### Note
This is **correct behavior** — these sessions truly did 0 state-changing ops. However, it means the DB cannot distinguish "verified with 5 read calls" from "never ran." Evaluations (productive=0) confirm correctness.

## Finding 3: Historical Sessions Pre-Date opCount Tracking

**Severity**: High (bulk of the problem, but unfixable)  
**Affected**: ~9,276 heartbeat sessions + ~1,325 non-heartbeat sessions before opCount tracking

### Mechanism
- opCount tracking was introduced around 2026-03-16 (first session with opCount > 0: `s_1773664856736_294`)
- All sessions before this date have `opCount=0` or `NULL` in both DB and meta.json
- These sessions were later imported into the DB by `session-sync`, which read their meta.json files (no opCount field) and defaulted to 0

### Scale
```
Period       | Total HB | With Ops | Zero Ops
older (>5d)  | 14,359   | 5,083    | 9,276
2-5d ago     | 1,844    | 1,744    | 100
24-48h ago   | 516      | 502      | 14
last 24h     | 134      | 129      | 5
```

The "older" category accounts for **86% of all zero-ops sessions**. Recent data (last 5 days) has 94-96% accuracy for heartbeat sessions and 91-94% for non-heartbeat sessions.

## Finding 4: Session-Sync INSERT OR REPLACE Could Race With DbWriter

**Severity**: Low (mitigated by design)  
**Potential but unlikely**

### Mechanism (theoretical race)
1. Session ends → `DbWriter` calls `updateSessionDb()` which uses `CASE WHEN ? > opCount` (safe)
2. Session-sync runs → reads meta.json → `INSERT OR REPLACE` (overwrites entire row)
3. If session-sync reads a stale meta.json AFTER DbWriter wrote correct opCount, it could overwrite

### Why it's mitigated
- `manager-receipts.ts` persists opCount to meta.json on every state-changing tool call
- By session end, meta.json already has the correct opCount
- Session-sync reads the same meta.json that has the final opCount
- Only affected if meta.json write failed (best-effort try/catch)
- Verified: all recent completed sessions with opCount in meta.json match DB exactly

## Architecture Summary

```
Tool call (state-changing)
  → manager-receipts.ts: session.opCount++ (in-memory)
  → manager-receipts.ts: meta.opCount = session.opCount (meta.json, per-call)

Session start event
  → DbWriter: INSERT sessions row, opCount=0

Session end event  
  → DbWriter: UPDATE sessions SET opCount = CASE WHEN event.opCount > opCount ...

Every 5 minutes
  → session-sync handler: INSERT OR REPLACE from meta.json (opCount ?? 0)
```

**The gap**: Between session_start and first session-sync cycle, DB shows opCount=0 for running sessions. This is the source of the "session-sync handler shows 0 ops for active sessions" observation.

## Recommendations

### P0: No action needed
- The system works correctly for recent sessions (>94% accuracy in last 5 days)
- Running session opCount gap is at most 5 minutes (session-sync interval)
- Historical 0-ops data cannot be retroactively fixed

### P2: Incremental DB updates for running sessions (optional)
- Add opCount increment to DbWriter on `turn_end` events (not just `session_end`)
- Would eliminate the 5-minute stale window for monitoring queries
- Trade-off: more DB writes per session (~10-40 extra writes per session)

### P2: Track read-only ops separately (optional)
- Add `readOpCount` or `totalToolCalls` to DB schema
- Would distinguish "verified with 10 reads" from "never ran"
- Low priority — evaluations already capture this via `productiveCalls`

### P3: Add NOT NULL DEFAULT 0 constraint
- Prevent future NULL opCount values in the sessions table
- Minor schema cleanup
