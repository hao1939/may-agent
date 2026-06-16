---
title: "Fix DB size metric and WAL checkpoint: include WAL in measurement + explicit checkpoint"
date: 2026-06-16
author: arc
status: proposed
priority: P1
related: [KE-2016, KE-1986, KE-2009]
---

# Fix DB size metric and WAL checkpoint

## Problem

The `infra.persist.db-size-mb` metric reports only the main `.db` file size
(1,352 MB) while the WAL journal is 1,356 MB — combined 2,708 MB disk usage.
The 2,000 MB threshold is intended to protect against disk exhaustion, but
the metric cannot fire because it only sees half the actual usage. True disk
usage already exceeds the threshold by 35%.

Additionally, VACUUM runs hourly but the WAL never shrinks because no
explicit checkpoint is issued before VACUUM (concurrent connections prevent
automatic checkpoint).

## Proposed Changes

### Change 1: Include WAL in metric (metrics-snapshot.ts)

In `agents/may/handlers/metrics-snapshot.ts`, around line 263:

```typescript
// Current:
const dbPath = join(ctx.sdk.paths.root, ".state", "may.db");
if (existsSync(dbPath)) {
  const sizeMb = parseFloat((statSync(dbPath).size / (1024 * 1024)).toFixed(2));
  record("infra.persist.db-size-mb", sizeMb);
}

// Proposed:
const dbPath = join(ctx.sdk.paths.root, ".state", "may.db");
if (existsSync(dbPath)) {
  let totalBytes = statSync(dbPath).size;
  const walPath = dbPath + "-wal";
  if (existsSync(walPath)) totalBytes += statSync(walPath).size;
  const sizeMb = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
  record("infra.persist.db-size-mb", sizeMb);
}
```

### Change 2: Add WAL checkpoint to db-retention handler (db-retention.ts)

In `agents/may/handlers/db-retention.ts`, before the VACUUM block (~line 204):

```typescript
// Checkpoint WAL before VACUUM to reclaim journal space
try {
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
  ctx.sdk.log("info", `[db-retention] WAL checkpoint (TRUNCATE) complete`);
} catch (e) {
  ctx.sdk.log("info", `[db-retention] WAL checkpoint failed (non-critical): ${e}`);
}
```

## Expected Impact

1. **Metric accuracy**: Immediately jumps from 1,351 → ~2,708 MB, triggering
   the threshold alert (correctly). This makes the real state visible.
2. **WAL shrinkage**: Explicit TRUNCATE checkpoint should reduce WAL to near
   0 bytes after successful checkpoint, reducing total disk by ~1,356 MB.
3. **Ongoing**: Combined metric prevents future silent WAL growth from hiding
   disk usage.

## Risks

- After Change 1, the metric will immediately alert (2,708 > 2,000). This is
  correct behavior — the alert was being suppressed by measurement error.
- PRAGMA wal_checkpoint(TRUNCATE) requires exclusive access. If concurrent
  readers prevent it, the PASSIVE fallback still checkpoints committed frames.
  Consider `PRAGMA wal_checkpoint(PASSIVE)` if TRUNCATE consistently fails.
- If the .db file itself is legitimately >2,000 MB after WAL is absorbed,
  the threshold may need raising. But the current 7-day event retention
  should keep steady-state well under 2 GB.

## Validation

After deployment:
1. `ls -la /app/.state/may.db*` — WAL should be near 0 after first checkpoint
2. Metric should report total disk usage (DB + WAL)
3. If total < 2000 MB post-checkpoint, system is healthy
4. Monitor growth rate: should be ~106 MB/day text ingest, with weekly
   VACUUM keeping it flat at ~7 days of data
