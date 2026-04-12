# Lens D: Request Tracking DB — Fragility Analysis

**Date:** 2026-04-12  
**Analyst:** tech-lead  
**DB:** `.state/may.db` (90 MB, SQLite WAL mode)

---

## Executive Summary

The request tracking DB is **functionally correct** (integrity checks pass, zero orphaned
IN_PROGRESS records, zero active duplicates) but has **three structural problems** that will
cause increasing drag:

| Problem | Impact Now | Impact at 6 months |
|---|---|---|
| 1. No retention / archiveOld never called | 90 MB DB, 44ms full scans | 300+ MB, index degradation |
| 2. Duplicate session_digests (56% duplication) | 17.5 MB wasted | Corrupts aggregate analytics |
| 3. session_digests.task stores full 30KB eval prompts | 30 MB of one column | Dominant storage cost |

**Risk verdict:** Medium. No corruption risk, but unbounded growth will eventually degrade
query performance and VACUUM operations.

---

## 1. Current State

### Table Sizes
| Table | Rows | Text Data | Growth/day |
|---|---|---|---|
| requests | 24,034 | 6.7 MB | ~1,000 |
| sessions | 19,692 | 6.7 MB | ~800 |
| evaluations | 20,094 | 6.4 MB | ~800 |
| convention_checks | 59,232 | 0.9 MB | ~4,000 |
| session_digests | 7,459 | 31.2 MB | ~300 |
| gym_runs/checks | 4,019 | small | ~100 |

**session_digests.task** alone is **30 MB** — the evaluator stores full evaluation prompt
text (avg 4.2KB, max 32KB) as the "task" when digesting sessions.

### Indexes
37 indexes across tables. The critical heartbeat injection query
(`WHERE toAgent = ? AND status IN (...) AND method IN (...)`) uses only `idx_to_agent`
(single-column), requiring a post-filter scan of all rows for that agent.

### Performance
| Query | Latency | Notes |
|---|---|---|
| `getActiveRequests()` | 0.07 ms | Status index → ~8 active rows |
| Heartbeat injection query | 1-5 ms | `idx_to_agent` + filter |
| `getRequestsByAgent('may')` | 32 ms | Scans all 15K 'may' rows |
| `isDuplicate()` | 0.01 ms | Exact 3-field match |
| Full table scan | 44 ms | No index used |

### Retention
- `archiveOld()` is **defined** in `src/lib/requests.ts:585` but **never called** anywhere.
- No cron job, no startup hook, no manual cleanup mechanism.
- All tables grow without bound.

---

## 2. Findings

### F1: Duplicate Session Digests (HIGH — easy fix, big impact)

**Problem:** 3,286 out of 7,459 digest sessions have duplicate rows. 4,168 wasted rows
consuming **17.5 MB** (19% of DB).

**Root cause:** The digest writer uses `INSERT OR REPLACE` keyed on `sessionId`, but the
`session_digests` table has `sessionId TEXT NOT NULL` as part of a primary key — likely
`(sessionId, action)`. When the same session is digested with different `action` values
(e.g., "done" and "zombie_cleanup"), both rows persist. But when the same action is
digested twice (race between evaluator and zombie cleanup), both survive because the
UNIQUE constraint may include a timestamp or the REPLACE path isn't matching.

**Impact:** Inflated analytics. Any `GROUP BY agent` query double-counts these sessions.

**Fix:** Add a dedup pass:
```sql
DELETE FROM session_digests 
WHERE rowid NOT IN (SELECT MIN(rowid) FROM session_digests GROUP BY sessionId);
```
Then ensure the insert path uses `INSERT OR REPLACE INTO session_digests ... ON CONFLICT(sessionId) DO UPDATE ...`.

### F2: No Retention Policy (MEDIUM — grows ~3 MB/day)

**Problem:** All 6 data tables grow without bound. `archiveOld()` exists but is dead code.
At current rates:
- 30 days: ~120 MB
- 90 days: ~200 MB  
- 180 days: ~350 MB

SQLite handles this fine up to a few hundred MB, but:
- `VACUUM` becomes expensive (locks DB during full rewrite)
- Compound queries (`getRequestsByAgent`) scan more rows
- WAL file grows larger between checkpoints

**Fix:** Wire up `archiveOld()` as a daily cron job. Recommended retention:
- `requests`: 30 days for COMPLETED/FAILED (keep CREATED/IN_PROGRESS forever)
- `sessions`: 30 days for done/error sessions
- `evaluations`: 30 days
- `convention_checks`: 7 days (fast-growing, low-value historical data)
- `session_digests`: 14 days (high per-row cost)

### F3: Bloated session_digests.task Column (MEDIUM)

**Problem:** The evaluator passes the full evaluation prompt (including the entire session
transcript!) as the "task" when creating digests. Average 4.2 KB per row, max 32 KB.
This single column is 30 MB — 33% of the DB.

**Fix:** Truncate task text at digest creation time:
```typescript
// In digest writer
const task = rawTask.slice(0, 500); // Match requests.task limit
```
The full task is already stored in `sessions.task` (which is also large at 5.7 MB but
serves a different purpose).

### F4: Missing Compound Index for Heartbeat Injection (LOW)

**Problem:** The heartbeat injection query is:
```sql
SELECT task, fromEntity, createdAt, requestId FROM requests
WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') 
  AND method IN ('message', 'send', 'fork', 'run')
ORDER BY createdAt ASC
```
Currently uses `idx_to_agent` (single column), then post-filters ~15K rows for 'may'.
Takes 5ms, which is acceptable, but a compound index would make it O(1):

```sql
CREATE INDEX idx_agent_status ON requests(toAgent, status);
```
This would let SQLite seek directly to (may, CREATED) and (may, IN_PROGRESS) — typically
~5 rows, sub-millisecond.

### F5: 37 Indexes — Diminishing Returns (LOW)

With 37 indexes across 7 tables, every INSERT pays the cost of maintaining all of them.
Several appear redundant or low-value:
- `idx_created` on requests (only useful for time-range scans, rare)
- `idx_cc_conv` on convention_checks (used for per-convention queries, but convention_checks
  itself is pruning-eligible)

Not urgent — SQLite B-trees are efficient — but worth auditing if write latency becomes
a concern.

---

## 3. Recommendations (Ordered by ROI)

### P0 — This sprint
1. **Deduplicate session_digests** — One-time SQL cleanup + fix insert path. Saves 17.5 MB.
2. **Wire up retention cron** — Add `archiveOld()` call to the existing cron system.
   Start conservative (30 days for requests, 7 days for convention_checks).

### P1 — Next sprint
3. **Truncate digest task text** — Cap at 500 chars at insert time. Saves ~29 MB.
4. **Add compound index** — `(toAgent, status)` on requests table. One migration line.

### P2 — Backlog
5. **Audit index necessity** — Profile actual query patterns over a week, drop unused indexes.
6. **Consider archiving to separate DB** — Move old data to `may-archive.db` instead of
   deleting, for historical analysis.

---

## 4. What's NOT Broken

- **DB integrity:** `PRAGMA quick_check` and `PRAGMA integrity_check` both pass.
- **Concurrent access:** WAL mode + busy_timeout(5000) handles multi-process safely.
- **Orphan detection:** Zero orphaned IN_PROGRESS requests (sessions that ended but
  didn't update request status). The session-subscriber cleanup works.
- **Duplicate detection:** `isDuplicate()` prevents active duplicate requests; zero
  active duplicates in current DB.
- **Error resilience:** All DB operations are wrapped in try/catch with silent fallback.
  DB failures never crash the agent.
- **Query performance:** Critical-path queries (heartbeat injection, isDuplicate) are
  fast enough (<5ms).

---

## 5. Growth Projections

```
Current:    90 MB, 130K total rows
30 days:   ~150 MB, 230K rows (without retention)
90 days:   ~280 MB, 430K rows
180 days:  ~470 MB, 820K rows

With retention (30-day for most, 7-day for convention_checks):
Steady-state: ~100-120 MB
```

The system is stable for months even without intervention, but the dedup fix alone
recovers 20% of DB size immediately.
