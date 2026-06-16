---
id: KE-2016
title: "DB Size Metric Underreports Disk Usage — WAL at 1356 MB Invisible to Threshold"
date: 2026-06-16
author: arc
status: resolved
tags: [infrastructure, db-size, wal, metric-accuracy, disk-usage, threshold]
related: [KE-1986, KE-2009]
---

<ai_context>
summary: The `infra.persist.db-size-mb` metric measures only the main may.db file (1352 MB) but ignores the WAL journal (may.db-wal, 1356 MB). True disk usage is 2708 MB — already 35% above the 2000 MB threshold that the metric was designed to protect. The metric reports 1352 (green, 68% of threshold) while actual disk is 2708 (red, 135% of threshold). Root cause: metrics-snapshot.ts line ~263 uses `statSync(dbPath).size` on just the .db file. The VACUUM runs hourly and reports success, but in WAL mode with concurrent connections, WAL grows unboundedly between checkpoints. At current 150 MB/day growth rate, the .db file alone hits 2000 MB in ~4 days. Proposed fixes: (1) include WAL+SHM file sizes in the metric, (2) add explicit `PRAGMA wal_checkpoint(TRUNCATE)` to db-retention handler, (3) consider whether WAL mode is needed or if DELETE journal mode would be simpler.
triggers: heartbeat disk check, db size growth rate, WAL discovery
</ai_context>

## Observation

At 2026-06-16 ~16:20Z, actual disk usage for the runtime DB:

| File | Size |
|------|------|
| may.db (main) | 1,352 MB |
| may.db-wal (WAL journal) | 1,356 MB |
| may.db-shm (shared memory) | 2.7 MB |
| **Total disk** | **2,708 MB** |

The `infra.persist.db-size-mb` metric reports **1,351 MB** (just the .db file).
The threshold is **2,000 MB**. The metric says "safe" (68% of threshold).
Reality says "breached" (135% of threshold).

## Root Cause

`agents/may/handlers/metrics-snapshot.ts` (~line 263):
```typescript
const sizeMb = parseFloat((statSync(dbPath).size / (1024 * 1024)).toFixed(2));
```

This measures only `may.db`. The WAL journal (`may.db-wal`) and shared
memory (`may.db-shm`) are separate files that contribute to actual disk
usage but are not measured.

## Why WAL Is So Large

The db-retention handler runs hourly and VACUUM's successfully (per event
logs: `vacuumed: 1`). However:

1. In WAL mode, VACUUM rebuilds the main DB file and resets the WAL
2. BUT if other connections hold read transactions during VACUUM, the WAL
   cannot be truncated (SQLite WAL semantics)
3. The runtime has persistent connections (metric snapshots every 5min,
   concurrent agent sessions, event handlers)
4. Result: WAL grows continuously between VACUUMs and may never fully
   checkpoint

The WAL being ~equal to the main DB size (1356 vs 1352) suggests it
hasn't been successfully truncated in the DB's entire 14-day retention
window — all writes are accumulating in the WAL.

## Growth Rate

| Window | DB growth |
|--------|-----------|
| Last 24h | 147 MB (1204 → 1351) |
| Daily ingest | ~106 MB text (37k events × 2.6KB + 3.7k workflow_runs × 3.3KB) |
| Days to .db threshold | ~4 days |
| **Days to actual disk crisis** | **Already there** (2708 > 2000) |

## Data Volume (Current)

| Table | Rows | Text Size |
|-------|------|-----------|
| events | 231,626 | 472.7 MB |
| workflow_runs | 33,912 | 125.1 MB |
| metric_snapshots | 232,956 | ~2 MB (numeric) |
| session_digests | 37,443 | 8.7 MB |
| sessions | 17,961 | — |
| evaluations | 16,600 | 8.6 MB |

## Proposed Fixes (ascending urgency)

### Fix 1: Metric accuracy (P2, one-line change)
Include WAL size in the metric measurement:
```typescript
const dbSize = statSync(dbPath).size;
const walPath = dbPath + '-wal';
const walSize = existsSync(walPath) ? statSync(walPath).size : 0;
const sizeMb = parseFloat(((dbSize + walSize) / (1024 * 1024)).toFixed(2));
```

### Fix 2: Explicit WAL checkpoint (P2, two-line addition to db-retention)
Before VACUUM, force a WAL checkpoint:
```typescript
db.run("PRAGMA wal_checkpoint(TRUNCATE)");
```
This truncates the WAL to zero bytes if no readers are active. Even
`PASSIVE` mode would checkpoint committed frames without blocking.

### Fix 3: Audit journal mode necessity (P3, deferred)
If WAL mode isn't needed (single-writer system), switching to DELETE
journal mode eliminates the WAL growth problem entirely.

## Falsification

- **F1**: If VACUUM is actually truncating the WAL and the WAL regrew to
  1356 MB in the last hour, then write volume is ~1356 MB/hr — check
  `session.start`/`session.end` event sizes and count per hour
- **F2**: If the metric includes WAL size after Fix 1 and still shows
  <2000 MB, the WAL is not the issue (check for other .state files)

## Status

**RESOLVED 2026-06-16T18:52Z** — Fix 1 + Fix 2 deployed:
- Fix 1 (metric accuracy): metrics-snapshot.ts now sums may.db + may.db-wal + may.db-shm sizes.
- Fix 2 (WAL checkpoint): db-retention.ts runs `PRAGMA wal_checkpoint(TRUNCATE)` before VACUUM.
- Post-deploy evidence: WAL dropped from 1.4GB to 1.4MB on daemon restart. Total DB ~1.4GB, under 2000MB threshold.
- Bundle rebuilt and daemon restarted (pid 1686768). Next metric snapshot will report accurate disk usage.
