# Lens B: metrics-snapshot.ts Measurement Flow Complexity

**File**: `agents/may/handlers/metrics-snapshot.ts` (409 LOC)
**Invocation**: `agents/may/cron.json` → `metrics-snapshot` entry, 1h interval, offsetMs 180000
**Date**: 2026-04-15

---

## Summary

The handler is well-structured with clear separation of concerns. The flow is flat (no deep indirection) and mostly correct. Main issues: (1) code duplication between auto and command measurement paths, (2) `research_log` table schema is an orphan in this file, (3) `getSampleSize` is fragile regex-based SQL rewriting, (4) regression detection is unidirectional (only detects drops, not spikes for `alert_direction='above'` metrics).

**Severity**: Low — no correctness bugs found, but moderate maintenance debt.

---

## Q1: How many hops from cron tick to measurement persistence?

**Answer: 2 hops — very flat.**

1. Cron engine calls `create(ctx, entry)` → returns async closure
2. Closure runs: `db.prepare(source_query).get()` → `INSERT INTO metric_snapshots` → `UPDATE metrics`

No indirection layers, no event buses, no intermediate abstractions. The handler does everything inline. This is appropriate for a 409-LOC handler.

## Q2: Are threshold checks and alert creation well-separated or entangled?

**Partially entangled.** Threshold checks happen inline inside the measurement loops (lines 286-299 for auto, lines 330-343 for command). Alert creation is cleanly delegated to `recordAlertWithDedup()` (lines 128-141). Regression detection is in a separate `checkRegression()` function (lines 146-169). Alert resolution is in `resolveRecoveredAlerts()` (lines 174-218).

The threshold check logic is **duplicated verbatim** between the auto-measure block (lines 286-299) and the command-measure block (lines 330-343). Both contain identical:
```ts
const alertAbove = m.alert_direction === 'above';
const breaching = alertAbove ? value > m.threshold : value < m.threshold;
```

**Recommendation**: Extract a `checkThresholdAndAlert(db, metric, value, now)` helper. ~15 lines of duplication.

## Q3: What happens when a measurement source fails mid-batch?

**Handled correctly.** Both auto-measure (lines 259-302) and command-measure (lines 308-348) wrap each individual metric in try/catch. Failures increment an `errors` counter and log via `ctx.log()`. The batch continues to the next metric.

However, there are **silent continue paths** that are not logged:
- Line 262: `if (!m.source_query) continue;` — no log
- Line 265: `if (!row) continue;` — no log (query returned no rows)
- Line 268-269: `if (isNaN(value)) continue;` — no log (query returned non-numeric)
- Line 316: `if (!m.source_command) continue;` — no log

These are arguably correct (they're config issues, not runtime failures), but the `!row` and `isNaN` cases could mask broken source_queries that silently return nothing.

## Q4: Is the regression detection logic correct?

**Partially correct — unidirectional flaw.**

`checkRegression()` (lines 146-169) computes:
```ts
const changeRatio = (avg7d.avg_val - currentValue) / avg7d.avg_val;
if (changeRatio > sensitivity) { ... }
```

This only detects **drops** (current below 7d average). For metrics with `alert_direction='above'` (e.g., error counts), a regression would be a **spike** upward — which this code would not catch. The `changeRatio` would be negative for upward moves, never exceeding the positive sensitivity threshold.

Similarly, `resolveRecoveredAlerts()` (lines 193-207) handles regression alert resolution by checking `changeRatio <= DEFAULT_SENSITIVITY`, which works for the drop case but not the spike case.

**Impact**: Low in practice — all current `alert_direction='above'` metrics also have explicit thresholds (health type), so threshold checks catch them. But the regression detection is architecturally incomplete.

## Q5: Dead code paths or unused branches?

### Finding 5a: `research_log` table schema (lines 96-104, 109)

The `SCHEMA_SQL` constant includes `CREATE TABLE IF NOT EXISTS research_log` and its index. This table is never read or written by `metrics-snapshot.ts`. It exists here only because `ensureTables()` runs on every invocation and this was a convenient place to put the DDL during initial development. The `research_log` table is populated by `research-sync` handler and queried indirectly via metric source_queries.

**Recommendation**: Move `research_log` DDL to `research-sync.ts` or a shared schema file.

### Finding 5b: `getSampleSize()` fragile regex SQL rewriting (lines 227-241)

This function attempts to extract sample size by regex-parsing the source_query's FROM and WHERE clauses and constructing a COUNT query. It uses `sourceQuery.match(/FROM\s+(\w+)/i)` which fails for:
- Subqueries in FROM
- JOINs
- CTEs
- Qualified table names (schema.table)

It's wrapped in try/catch so failures are silent (returns null). Of 13 auto metrics in the DB, most use simple single-table queries, so it works in practice. But it's technical debt — a regex SQL parser is inherently fragile.

**Recommendation**: Either remove sample_size tracking (it's stored but never queried downstream) or use a simpler approach like counting rows in the result set.

### Finding 5c: `one-off` completion check only in auto path (line 283-286)

```ts
if (m.type === "one-off" && value >= 1) {
  db.prepare("UPDATE metrics SET status = 'done', closed_at = ? WHERE id = ?").run(now, m.id);
```

This only runs for auto-measured metrics. If a one-off metric used `source='command'`, it would never auto-close. Currently all one-off metrics are `source='manual'` (e.g., `ops.prompt-caching`), so this branch never fires for any metric type. Manual metrics are never measured by this handler at all.

**Impact**: Dead code — no one-off metrics are auto-measured, and command-measured one-offs would silently never close.

### Finding 5d: `stalled metrics` check includes auto/command metrics (lines 354-367)

The stall check runs on ALL active metrics. For auto and command metrics, the handler itself just updated `updated_at`, so they'll never be stalled. The stall check is really only useful for `source='manual'` metrics, but it queries all active metrics. This is not a bug (the updated_at check filters correctly), just unnecessary work.

---

## Architecture Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Flow clarity | ✅ Good | Flat, sequential, easy to trace |
| Error handling | ✅ Good | Per-metric try/catch, errors counted |
| Code duplication | ⚠️ Moderate | Threshold check duplicated between auto/cmd paths |
| Schema ownership | ⚠️ Misplaced | research_log DDL doesn't belong here |
| Regression logic | ⚠️ Incomplete | Unidirectional — misses upward regressions |
| getSampleSize | ⚠️ Fragile | Regex SQL parser, results never consumed |
| Overall | Low risk | No correctness bugs, moderate maintenance debt |

---

## Recommended Follow-ups (do NOT fix in this session)

1. **Extract shared `checkThresholdAndAlert()` helper** — eliminate 15-line duplication between auto and cmd measurement paths
2. **Move `research_log` DDL** to research-sync handler or shared schema
3. **Fix bidirectional regression detection** — respect `alert_direction` in `checkRegression()`
4. **Audit `sample_size` usage** — if nothing reads it, remove `getSampleSize()` entirely
5. **Add logging for silent-continue paths** — especially `!row` and `isNaN(value)` cases
