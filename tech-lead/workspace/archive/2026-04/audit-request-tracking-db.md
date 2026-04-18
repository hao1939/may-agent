# Audit: Request Tracking DB Fragility

**Date**: 2026-04-12  
**Investigation session**: s_1775994854603_2096  
**Status**: Complete — findings documented, fixes not yet implemented

## Executive Summary

The request tracking DB (`may.db`) is **90MB and growing ~1K requests/day** with no retention policy, no pruning, and no archival in practice. The `archiveOld()` function exists in code but is never called. The largest single data contributor is `session_digests.task` at 30MB — the evaluator stores full 30KB task texts verbatim. 4,168 duplicate digest rows waste 17.5MB. Convention checks grow 4K rows/day with no cleanup. Indexing is heavy (37 indexes) but misses the critical compound query pattern used in heartbeat injection.

**Total wasted/reclaimable space**: ~50MB (55% of current DB size)

---

## Finding 1: No Retention Policy — archiveOld() Never Called

**Risk**: P1  
**Growth rate**: ~1K requests/day, unbounded

The `archiveOld()` function exists in `src/lib/requests.ts` and is designed to move old records to an archive table. However, it is **never invoked** — not from cron, not from startup, not from any code path. The DB grows monotonically.

**Tables affected**: All request-tracking tables (`requests`, `session_digests`, `convention_checks`)

**Fix**: Wire `archiveOld()` into the cron handler (e.g., daily at 03:00). Add a retention window parameter (suggest 7 days for requests, 3 days for convention_checks). Validate it actually runs by checking archive table row count after deployment.

**Effort**: Small (1-2 hours). The function exists, just needs to be called and tested.

---

## Finding 2: session_digests.task Column is 30MB

**Risk**: P1  
**Impact**: Single column accounts for 33% of DB size

The evaluator stores full task descriptions (up to 30KB each) in the `session_digests.task` column. These are the complete task texts passed to agents, not summaries. The raw text is rarely queried after evaluation completes.

**Fix options**:
1. **Truncate on insert**: Store only first 500 chars + hash of full text (enough for dedup and display)
2. **Move to separate table**: Keep a `task_texts` table with hash-based dedup, reference by hash from `session_digests`
3. **Prune after N days**: Delete task text for digests older than 7 days, keep metadata

**Recommended**: Option 1 (truncate on insert). Simplest, prevents future growth. Option 3 as a complement via archiveOld().

**Effort**: Small-medium (2-3 hours). Requires change in evaluator's digest insertion logic.

---

## Finding 3: 4,168 Duplicate Digest Rows (17.5MB wasted)

**Risk**: P1  
**Impact**: 17.5MB of pure waste, ongoing duplication

Duplicate rows in `session_digests` — same session getting digested multiple times. Likely caused by evaluator re-runs or lack of upsert/dedup logic on insert.

**Fix**:
1. **Immediate**: One-time dedup query to delete duplicates (keep newest per session)
2. **Preventive**: Add UNIQUE constraint on `(sessionId)` or use INSERT OR REPLACE
3. **Defensive**: Add dedup check before insert in the evaluator code

**Recommended**: All three. Immediate cleanup + schema constraint + code guard.

**Effort**: Small (1-2 hours). The dedup query is straightforward; the constraint prevents recurrence.

---

## Finding 4: convention_checks at 59K Rows, Growing 4K/day

**Risk**: P2  
**Impact**: Table will hit 100K+ rows within 2 weeks, no cleanup path

`convention_checks` stores per-session convention compliance results. At 4K rows/day with no retention, this becomes the largest table by row count. The data has diminishing value after a few days — older checks are irrelevant once conventions evolve.

**Fix**: Add retention to archiveOld() — delete convention_checks older than 3 days. Optionally keep aggregate stats (pass/fail counts per convention per day) in a summary table before deletion.

**Effort**: Small (1 hour). Just a DELETE WHERE created_at < ? in the archive function.

---

## Finding 5: Missing Compound Index for Heartbeat Injection

**Risk**: P2 (performance, not correctness)  
**Current behavior**: `getRequestsByAgent()` takes 32ms with single-column index  
**Query pattern**: `WHERE toAgent = ? AND status = ? AND method = ?`

The heartbeat injection query filters on `toAgent`, `status`, and `method` but only has single-column indexes. A compound index would reduce this to <5ms.

**Fix**: Add compound index:
```sql
CREATE INDEX IF NOT EXISTS idx_requests_agent_status_method 
ON requests(toAgent, status, method);
```

**Effort**: Trivial (15 minutes). One migration line. Test with EXPLAIN QUERY PLAN before/after.

---

## Finding 6: 37 Indexes — Possible Over-Indexing

**Risk**: P2  
**Impact**: Write amplification on every INSERT, marginal read benefit for rarely-used indexes

37 indexes across the DB tables is high. Many were likely added speculatively. Each index slows writes and increases DB size. Some may be redundant (e.g., single-column indexes that are prefixes of compound indexes, or indexes on columns only used in rare admin queries).

**Fix**: 
1. Audit each index with `EXPLAIN QUERY PLAN` on actual queries
2. Drop indexes that aren't used by any hot path
3. Consolidate overlapping indexes

**Effort**: Medium (3-4 hours). Requires mapping each index to its query consumers.

---

## Finding 7: Heartbeat Injection Query is 5ms (Acceptable)

**Risk**: None (informational)  
**Current behavior**: The core heartbeat injection path performs adequately

This was validated during investigation — no action needed. The 5ms query time is well within the heartbeat cycle budget.

---

## Priority Summary

| # | Finding | Risk | Effort | Impact |
|---|---------|------|--------|--------|
| 1 | archiveOld() never called | P1 | Small | Stops unbounded growth |
| 2 | session_digests.task 30MB | P1 | Small-Med | Recovers 30MB, prevents recurrence |
| 3 | 4,168 duplicate digests | P1 | Small | Recovers 17.5MB immediately |
| 4 | convention_checks 59K rows | P2 | Small | Prevents future bloat |
| 5 | Missing compound index | P2 | Trivial | Speeds up getRequestsByAgent() 6x |
| 6 | 37 indexes over-indexed | P2 | Medium | Reduces write overhead |

## Recommended Execution Order

1. **Quick wins first**: Fix #3 (dedup cleanup) + Fix #5 (compound index) — immediate, low risk
2. **Wire retention**: Fix #1 (call archiveOld from cron) + Fix #4 (add convention_checks to retention)
3. **Structural**: Fix #2 (truncate task text on insert) — requires evaluator code change
4. **Audit**: Fix #6 (index audit) — do when there's slack time

## Raw Numbers

| Metric | Value |
|--------|-------|
| Total DB size | 90MB |
| Total requests | 24K |
| Growth rate | ~1K requests/day |
| session_digests.task size | 30MB |
| Duplicate digests | 4,168 rows (17.5MB) |
| convention_checks rows | 59K |
| convention_checks growth | 4K rows/day |
| Total indexes | 37 |
| getRequestsByAgent() latency | 32ms |
| Heartbeat injection latency | 5ms |
| Reclaimable space (estimated) | ~50MB |
