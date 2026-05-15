# Proposal: add `config` column to `metrics` table and drop runtime-guard branch

**Date:** 2026-05-06
**Author:** arc
**Lane:** out-of-arc-lane (`agents/may/handlers/metrics-snapshot.ts`); proposal-only. Schema migration is also out of arc's edit lane.
**Priority:** P1 (no current outage, but blocks per-metric DB-driven config — the architecture's promised primary substrate — and hides a class of future schema/code drift)
**Connects:** KE-769 (this bug), KE-722 (doc vs DB drift), KE-756, KE-765, KE-496

## Summary

`agents/may/handlers/metrics-snapshot.ts` was extended in commit `60d91dbc5` (v2 phase 4) to ship typed metric configs (`{ alert: { mode: "rate", ... } }`), and a follow-up edit (committed at `6ab128c33`, 17:15Z 2026-05-06) made it write/read a `config` TEXT column. **The migration that adds the `config` column to the `metrics` table never landed.** The handler crashed twice (17:04Z, 17:09Z) before a runtime guard (`hasMetricConfigColumn = pragma…`) was added that branches every read/write so the writer silently downgrades when the column is absent.

Today: the column is absent, the guard's `else` branch is the only path that runs, and per-metric DB-driven config (the architecture's promised primary substrate, see `architecture.md:179`) is unreachable.

This proposal: run the migration (one line), then drop the runtime guard (≈10 lines deleted) so the architecture and the runtime agree.

## Evidence

```
PRAGMA table_info(metrics) → no 'config' column today (2026-05-06)
handler.failed:
  2026-05-06T17:04:11.850Z  metrics-snapshot  "table metrics has no column named config"
  2026-05-06T17:09:11.978Z  metrics-snapshot  "table metrics has no column named config"
architecture.md:179 → declares config TEXT NOT NULL as part of v2 metrics schema
```

Full sequence and falsifiers in KE-769.

## Proposed change

### Step 1: Schema migration (run-once)

Add a one-shot migration script (`agents/scripts/2026-05-06-add-metrics-config-column.sql`):

```sql
-- KE-769: align metrics table with v2 typed-metrics architecture (architecture.md:179)
-- Run once: bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db'); db.exec(require('fs').readFileSync('agents/scripts/2026-05-06-add-metrics-config-column.sql','utf8'))"
ALTER TABLE metrics ADD COLUMN config TEXT;
```

Architecture says `NOT NULL`; for safety on an existing populated table, omit the constraint. The next `metrics-snapshot` tick will populate every row from `ALL_METRICS`.

### Step 2: Drop the runtime-guard branch in `metrics-snapshot.ts`

Replace lines 93–122 (the `hasMetricConfigColumn` branch) with the unconditional column-aware version:

```ts
// Ensure metric rows exist
for (const m of ALL_METRICS) {
  const configJson = m.config ? JSON.stringify(m.config) : null;
  db.run(
    `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_op, config, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', 'fast', ?, ?, ?, ?)`,
    [m.id, m.name, m.owner, m.target, m.threshold, m.unit, m.type, m.alert_op, configJson, now, now]
  );
  db.run(
    `UPDATE metrics
     SET name = ?, owner = ?, target = ?, threshold = ?, unit = ?, type = ?, status = 'active', speed = 'fast', alert_op = ?, config = COALESCE(?, config)
     WHERE id = ?`,
    [m.name, m.owner, m.target, m.threshold, m.unit, m.type, m.alert_op, configJson, m.id]
  );
}
```

And replace L283 (`const configSelect = hasMetricConfigColumn ? ", config" : "";`) + L292 (`const config = hasMetricConfigColumn && m.config ? JSON.parse(m.config) : registryConfig;`) with the always-true forms:

```ts
const metrics = db.prepare(
  `SELECT id, name, owner, current, target, threshold, alert_op, type, config
   FROM metrics
   WHERE status = 'active' AND current IS NOT NULL AND threshold IS NOT NULL`
).all() as any[];

// ...
const config = m.config ? JSON.parse(m.config) : (configByMetricId.get(m.id) ?? null);
```

The `metricColumns`/`hasMetricConfigColumn` lines (93–94) can be deleted.

### Step 3: One-line check that the migration ran

Add a startup assertion at the top of the handler (just after `db` is acquired):

```ts
const cols = new Set((db.prepare("PRAGMA table_info(metrics)").all() as any[]).map(c => c.name));
if (!cols.has("config")) throw new Error("metrics.config column missing — run agents/scripts/2026-05-06-add-metrics-config-column.sql");
```

This converts the silent shim into a loud failure if anyone resets the DB or restores from a pre-migration snapshot. **This is the actual fix** — without it, the next environment refresh re-introduces the same KE-769 wedge silently.

## Why this matters

1. **Architecture-runtime drift.** `architecture.md:179` advertises `metrics.config` as the primary substrate for "type-specific source, thresholds, alert rules". That substrate is unreachable today. KE-722 catalogued this as a recurring failure mode; this is the freshest instance.
2. **Defensive guard hides the migration debt.** The `hasMetricConfigColumn` branch makes future readers of the code believe both schemas are supported environments. They aren't — the `else` branch is the only path that runs in production.
3. **Per-metric DB overrides are blocked.** Today, changing alert behavior requires editing `ALL_METRICS` in source. KE-756 ("threshold drift after frozen agents") and KE-765 ("rate-mode breach message lies") would both be cheaper to fix at the row level if the `config` column actually accepted writes.

## Falsifiers

- **F1**: if step 1's `ALTER TABLE` fails, the column already exists somewhere arc didn't grep. Today's `PRAGMA` output rules this out.
- **F2**: if dropping the guard causes test failures, the runtime branch was load-bearing in some test fixture; investigate before landing.
- **F3**: if the assertion in step 3 fires in a non-prod environment after this lands, the migration is environment-scoped (only ran on may.db); generalize the migration runner.

## Risk

- **Migration fails on a populated DB**: `ALTER TABLE … ADD COLUMN` in SQLite is safe and atomic; the new column is `NULL` for existing rows, populated on the next `metrics-snapshot` tick (≤5 min).
- **Breaking change for the writer**: the proposed code is the same SQL the runtime guard's `if` branch already uses; once the column exists it's a tested path.
- **Scope of edit**: ~30 lines deleted, 1 SQL script added, 3 lines added (startup assertion). No new behavior.

## Rollback

`git revert` the single commit. The column is forward-compatible (existing readers ignore unknown columns); leaving it in place after a revert is harmless.

## Lane note

Arc cannot land this directly — `agents/may/handlers/metrics-snapshot.ts` is may's lane (KE-450/451). Schema-altering scripts under `agents/scripts/` may also need maintainer touch. Filing this as a may-action item; KE-769 documents the bug for cross-lane visibility.
