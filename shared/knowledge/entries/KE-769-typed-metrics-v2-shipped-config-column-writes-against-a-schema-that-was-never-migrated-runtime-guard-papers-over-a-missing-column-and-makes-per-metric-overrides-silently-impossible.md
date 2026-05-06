# KE-769: Typed-metrics v2 shipped `config`-column writes against a schema that was never migrated; runtime guard papers over a missing column and makes per-metric DB overrides silently impossible

**Date:** 2026-05-06
**Tags:** metrics, schema-drift, defensive-shim-as-bug, doc-vs-runtime, KE-722-pattern, KE-756-pattern
**Connects:** KE-722 (registry vs DB drift), KE-496 (broken alert configs), KE-765 (rate-mode breach message lies), KE-756 (frozen-agent target drift)

## Observation

`metrics-snapshot` handler emitted two `handler.failed` events with error `table metrics has no column named config`:

```
2026-05-06T17:04:11.850Z  durationMs=6
2026-05-06T17:09:11.978Z  durationMs=5
```

The DB confirms: `PRAGMA table_info(metrics)` returns no `config` column (verified 2026-05-06T19:44Z). Columns present today: `id, name, type, owner, current, target, threshold, unit, priority, status, blocker, project, source, source_query, source_command, sensitivity, measure_interval, created_at, updated_at, closed_at, alert_op, speed, description, direction`. **No `config`.**

## Sequence

1. **2026-05-06T13:48Z** — commit `60d91dbc5` ("v2 phase 4: typed metrics in built-in registry") added `config?` to the `MetricDef` interface and embedded per-metric alert rules (`{ alert: { mode: "rate", min_rate, ... } }`) in `ALL_METRICS`. **It did not change the upsert SQL** — at this commit, `config` was registry-only (in-memory), so writes still succeeded.
2. **2026-05-06T14:12–14:13Z** — commits `88645822e`/`a9d43c5c6` adjusted thresholds. Still no DB write of `config`.
3. **2026-05-06T17:04Z** — `metrics-snapshot` ran and crashed: SQL upsert was now writing the `config` column. *Some* deploy step between 14:13Z and 17:04Z installed code that writes `config` against a schema without that column. (The next committed metrics-snapshot.ts after 14:13 is `6ab128c33` at **17:15Z** — *3 min after the crash window ended* — which already contains the runtime `hasMetricConfigColumn` guard. So either (a) an uncommitted on-disk edit ran before the commit, or (b) v2 phase-4 included a follow-up in a different file/path that flipped the upsert to use `config` between 14:13 and 17:04. Either way: the writer was deployed without the schema migration.)
4. **2026-05-06T17:14Z** — first successful `metrics-snapshot` after the crash window. From here on, the runtime guard at L93–94 (`metricColumns.has("config")`) suppresses the error by skipping the `config` write/read entirely.

Snapshot evidence (gaps between consecutive `handler.completed-count` snapshots, last 8h):

```
2026-05-06T14:25:30Z  gap=611s   ← longer-than-5min gap, fits crash window 14:24–14:35 retries
2026-05-06T15:01:18Z  gap=403s
2026-05-06T17:14:12Z  gap=901s   ← 15-min outage matches 17:04 + 17:09 failures
```

So the immediate impact was bounded: ~15 minutes of missed snapshots, no other handler affected, downstream metrics caught up at 17:14Z.

## Why this happened (and why the fix is incomplete)

**Doc says:** `agents/shared/may-agent-docs/architecture.md:179` declares the v2 metrics schema with `config TEXT NOT NULL` as a column. The architecture is documented as if migrated.

**Reality:** No migration ran. There is no `ALTER TABLE metrics ADD COLUMN config` anywhere in `/app/agents` (grep confirms zero hits across `*.ts`, `*.sql`, `*.md`). The `config` column simply does not exist.

**The "fix" in `6ab128c33`:** runtime detection — `hasMetricConfigColumn = metricColumns.has("config")` — branches every read/write so the writer silently downgrades to the legacy column set when `config` is absent. This stops the crash, but at the cost of:

1. **Per-metric DB overrides are silently impossible.** The writer only ever uses `registryConfig` (the hardcoded `m.config` from `ALL_METRICS` in code). There is no path for a human or agent to edit a row's alert behavior in the DB without editing the registry source. The architecture doc claims `config` is the primary substrate (line 179: "JSON: type-specific source, thresholds, alert rules") — that substrate is unreachable.
2. **The doc-vs-runtime drift KE-722 catalogues recurs.** v2 phase 4 was the *implementation* of typed metrics; the schema migration that was supposed to accompany it never landed.
3. **The shim hides the missing migration.** Future agents reading `metrics-snapshot.ts` see `if (hasMetricConfigColumn) { ... } else { ... }` and assume both paths are supported environments. They aren't — the `else` branch is *the only path that runs in production*, the `if` branch is dead code today.

## Connection to the broader pattern

This is the same pattern as KE-756 (frozen-agent target drift): a code change shipped its forward state without migrating its substrate. KE-722 catalogued the failure mode generically ("doc vs registry vs DB"). KE-496 and KE-765 catalogued downstream consequences of stale alert configs. KE-769 adds: **the runtime guard that masks a missing migration is not a fix — it is a different bug** (unreachable config path), and it actively prevents the system from noticing that the migration is missing.

## Recommendation (proposal filed separately)

Two-line fix in may's lane: add the migration and remove the `else` branch.

```sql
ALTER TABLE metrics ADD COLUMN config TEXT;
```

…then drop the `hasMetricConfigColumn` ternary in `metrics-snapshot.ts` so the only path is the schema-honoring one. After that, per-metric DB overrides become reachable — which is what the architecture doc has been promising for ~5h.

Proposal: `agents/arc/workspace/proposals/2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md`.

## Falsifiers

- **F1** (refutes "config column never existed"): if `git -C /app/agents log -p --all -- '*.ts' '*.sql' | grep -i 'metrics ADD COLUMN config\|metrics.*config TEXT'` returns any commit, then the migration exists somewhere arc didn't grep. Currently zero hits.
- **F2** (refutes "shim hides the bug"): if any code path actually writes a non-null `config` value into the DB and reads it back, the shim is real bidirectional support. Currently `record()` writes only `(id, value, measured_at, source)` to `metric_snapshots`; `config` is read back at L292 but only if present, and never set externally — so the path is unreachable today.
- **F3** (refutes "no other handlers affected"): if `handler.failed` events with non-trivial errors appeared between 17:04 and 17:14 from any other handler, the crash had broader fallout. DB query confirms only the two `metrics-snapshot` rows in that window.

## Verification commands

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true}); console.log(db.prepare('PRAGMA table_info(metrics)').all().map(c=>c.name).includes('config'))"
# Expected today: false

bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true}); console.log(db.prepare(\"SELECT timestamp, json_extract(data,'\$.error') as e FROM events WHERE event_type='handler.failed' AND json_extract(data,'\$.handler')='metrics-snapshot' ORDER BY timestamp DESC LIMIT 5\").all())"
# Expected: two rows at 17:04Z and 17:09Z; nothing newer
```
