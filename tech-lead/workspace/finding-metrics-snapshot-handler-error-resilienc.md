# Audit: metrics-snapshot.ts Error Resilience

**Date**: 2026-04-15  
**Scope**: `agents/may/handlers/metrics-snapshot.ts` (409 LOC), `src/lib/db.ts`, `src/lib/handler-context.ts`  
**Commit**: cc7e7556

---

## Summary

The handler is structurally solid for v1 — individual metric measurement failures are caught and logged. However, there are **6 fragility modes** ranging from low to high severity that could cause silent data loss, cascading failures, or misleading alert state.

---

## Findings

### F1: No top-level try/catch — unhandled throw kills entire run (HIGH)

**Location**: `metrics-snapshot.ts` lines 220–388 (the returned async function)  
**Evidence**: The `ensureTables(db)` call at line 222 and all Section 3 (stalled metrics, lines 313–330) and Section 4 (alert resolution, lines 334–345) run **outside** any try/catch. If `ensureTables()` throws (e.g., DB locked, disk full, schema conflict), the entire handler aborts — no metrics measured, no log, no error count.

Similarly, `resolveRecoveredAlerts()` at line 340 has no try/catch around it. A single malformed JOIN result or null dereference in that function kills the entire handler after all measurements are already recorded.

**Impact**: Complete silent failure of the hourly cron run. No metrics, no alerts, no summary log.  
**Recommendation**: Wrap the entire handler body in try/catch with `ctx.log()` for the outer error. Consider wrapping Sections 3 and 4 independently so a stall-check failure doesn't prevent alert resolution.

---

### F2: Partial-write state — no transaction around measure+update+snapshot (MEDIUM)

**Location**: Lines 234–268 (auto-measure loop), lines 280–311 (command-measure loop)  
**Evidence**: Each metric's measurement does 3 separate DB writes:
1. `INSERT INTO metric_snapshots` (line 243)
2. `UPDATE metrics SET current` (line 248)
3. Possibly `UPDATE metrics SET status = 'done'` (line 253) or `INSERT INTO metric_alerts` (via `recordAlertWithDedup`)

These are not wrapped in a transaction. If the process crashes between (1) and (2), the snapshot exists but `metrics.current` is stale. If it crashes between (2) and the alert insert, the value changed but no alert fired.

**Impact**: Stale `current` values, orphaned snapshots, missed alerts after crashes. Low probability per-run, but over months of hourly runs it's a matter of time.  
**Recommendation**: Wrap each metric's measure cycle in a `BEGIN/COMMIT` transaction, or at minimum wrap the entire measurement section in one transaction (all-or-nothing per cron fire).

---

### F3: `source_query` SQL injection / arbitrary code execution (MEDIUM)

**Location**: Lines 236–237, 183–193  
**Evidence**: `db.prepare(m.source_query).get()` executes whatever SQL is in the `source_query` column. This is by design (it's the metric's measurement query), but:
- A malformed or malicious `source_query` could `DROP TABLE` or corrupt data
- `getSampleSize()` (line 183) does regex extraction from `source_query` and builds a new SQL string via concatenation (`countSql = \`SELECT COUNT(*) ...\``) — this is injection-prone if `source_query` contains adversarial content

Similarly, `source_command` (line 285) runs arbitrary shell commands via `execSync`. The `CMD_TIMEOUT_MS = 10_000` is the only guard.

**Impact**: A bad seed metric or compromised DB row could corrupt or destroy the database. Currently all seeds are controlled by us, so risk is low in practice.  
**Recommendation**: Add a `source_query` allowlist (must start with `SELECT`) and validate `source_command` contains no destructive shell operators. Consider running commands in a restricted shell.

---

### F4: Alert dedup has a stale-alert accumulation problem (MEDIUM)

**Location**: `recordAlertWithDedup()` lines 110–120, `resolveRecoveredAlerts()` lines 133–170  
**Evidence**: Dedup checks `WHERE resolved_at IS NULL` — if an alert exists unresolved, new ones are suppressed. But `resolveRecoveredAlerts` only resolves alerts when:
- Health metric: `current >= threshold` (line 156)
- Regression: change ratio back within `DEFAULT_SENSITIVITY` (line 163)

Edge cases where alerts become permanently unresolved:
1. **Metric deleted or set to inactive** — the JOIN `metrics m ON m.id = ma.metric_id` still finds it, but `m.current` may be null/stale forever, so the alert never resolves. It also permanently blocks new alerts for that metric_id.
2. **Threshold changed** — the alert was created with old threshold; resolution checks `m.threshold` (current value). If threshold was lowered, the alert may resolve prematurely. If raised, it may never resolve.
3. **No avg_val** — for regression alerts, if there are no snapshots in 7d window (metric was paused), `avg_val` is null and the `if` block at line 161 skips resolution entirely. Alert stays forever.

**Impact**: Over time, unresolvable phantom alerts accumulate, permanently suppressing new alerts for those metrics.  
**Recommendation**: Add a staleness expiry — auto-resolve alerts older than 7d regardless. Or add a periodic cleanup that resolves alerts for inactive/deleted metrics.

---

### F5: `getSampleSize()` regex is fragile — silent wrong counts (LOW)

**Location**: `getSampleSize()` lines 183–196  
**Evidence**: The regex `/FROM\s+(\w+)/i` captures only the first table name. For queries like `SELECT avg(x) FROM metric_snapshots WHERE metric_id = ? AND measured_at > ?`, it builds `SELECT COUNT(*) FROM metric_snapshots WHERE metric_id = ? AND measured_at > ?` — but **without binding parameters**. The resulting query will fail (SQLite error on unbound `?` placeholders) and be silently caught by the `catch` block returning null.

For queries with subqueries, JOINs, or CTEs, the regex will extract the wrong table name, producing incorrect sample sizes.

**Impact**: `sample_size` in snapshots is almost certainly always null for parameterized queries. Misleading but not harmful since sample_size is informational only.  
**Recommendation**: Either fix to actually pass through parameters, or remove `getSampleSize()` since it's dead weight for parameterized queries.

---

### F6: Stall detection fires on every run for manual metrics without recent updates (LOW)

**Location**: Lines 313–330  
**Evidence**: For manual metrics (`source = 'manual'`), the default stall interval is `MS_48H` (48 hours). The stall check runs every hour. Once a manual metric goes 48h without update, `recordAlertWithDedup` fires — but only once due to dedup. However, if the alert is resolved (metric gets an update) and then goes stale again, it fires again. This is correct behavior.

BUT: There's no way to mark a manual metric as "expected to be slow" without setting `measure_interval`. If someone adds a manual metric and forgets `measure_interval`, it defaults to 48h stall detection, which may be too aggressive for weekly-measured metrics.

**Impact**: Noisy stall alerts for manual metrics with long natural intervals. Low severity since dedup prevents spam.  
**Recommendation**: Consider a longer default (7d) for manual metrics, or require explicit `measure_interval` on manual metrics.

---

## Priority Summary

| # | Finding | Severity | Effort to Fix |
|---|---------|----------|---------------|
| F1 | No top-level try/catch | HIGH | 10 min |
| F2 | No transaction around writes | MEDIUM | 15 min |
| F4 | Phantom unresolvable alerts | MEDIUM | 20 min |
| F3 | Unvalidated source_query/command | MEDIUM | 15 min |
| F5 | getSampleSize() always returns null | LOW | 10 min |
| F6 | Aggressive stall default for manual | LOW | 5 min |

## Recommended Fix Order

1. **F1** — wrap handler in top-level try/catch (trivial, highest impact)
2. **F4** — add alert staleness expiry (prevents phantom accumulation)
3. **F2** — add transaction wrapping (data integrity)
4. F3, F5, F6 — lower priority, address in next cleanup pass
