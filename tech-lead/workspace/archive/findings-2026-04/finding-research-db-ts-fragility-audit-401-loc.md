# Lens D: research-db.ts Fragility Audit

**File**: `src/lib/research-db.ts` (~330 LOC)  
**Date**: 2026-04-15  
**Auditor**: tech-lead  

## Summary

research-db.ts syncs markdown knowledge entries, hypotheses, and experiments into SQLite via `INSERT OR REPLACE`. The code is **structurally sound** — parameterized queries prevent SQL injection, per-file try/catch prevents single-file crashes from aborting the batch, and idempotent upserts make it safe to re-run. However, there are **5 findings** ranging from low to medium severity.

---

## Finding 1: No Transaction Wrapping (Medium)

**Evidence**: `syncKnowledgeEntries()` (line ~108), `syncHypotheses()` (line ~155), `syncExperiments()` (line ~205) — each iterates over files and calls `stmt.run()` per file with no `BEGIN`/`COMMIT` transaction.

**Impact**: 
- Each INSERT is auto-committed. If process crashes mid-sync, DB has partial state: some entries at new `synced_at`, others at old timestamp. No way to detect incomplete syncs.
- Performance: N auto-committed INSERTs are ~50-100x slower than N INSERTs in a single transaction. With ~50 knowledge entries, this is measurable (~100ms vs ~2ms).

**Recommendation**: Wrap each sync function's loop in `db.exec("BEGIN")` / `db.exec("COMMIT")` with a try/catch that calls `db.exec("ROLLBACK")` on failure. This makes sync atomic per category.

---

## Finding 2: Duplicate Evidence Field Extraction (Low — Bug)

**Evidence**: `src/lib/research-db.ts` lines 121-122:
```typescript
const evidenceRaw =
  extractField(content, "Evidence") ?? extractField(content, "Evidence");
```

The fallback is identical to the primary expression. This is a copy-paste bug — the `??` branch does nothing. If `extractField(content, "Evidence")` returns null, the fallback also returns null.

**Impact**: Evidence refs are never extracted from an alternate field name. Likely intended as `extractField(content, "Evidence refs")` or `extractField(content, "Evidence References")`.

**Recommendation**: Determine the intended fallback field name and fix. If no fallback is needed, simplify to a single call.

---

## Finding 3: Corrupt Markdown Overwrites Good Data (Medium)

**Evidence**: All three sync functions use `INSERT OR REPLACE` keyed on primary ID. A previously-good entry that gets corrupted (e.g., markdown reformatted, H1 removed, fields scrambled) will be overwritten with the degraded version. The `raw_content` column preserves the full text, but structured fields (status, claim, title) may become NULL.

**Impact**: No mechanism to detect or prevent data quality regression. A single bad edit to a knowledge entry file silently NULLs out its structured fields in the DB.

**Recommendation**: Before upserting, compare key fields with existing row. If the new parse yields NULL for a previously non-NULL field, log a warning. Alternatively, add a `last_good_sync` timestamp that only advances when all key fields are present.

---

## Finding 4: Error Handling Is Log-and-Forget (Low)

**Evidence**: `agents/may/handlers/research-sync.ts` lines 44-46:
```typescript
if (allErrors.length > 0) {
  ctx.log(`[research-sync] Errors: ${allErrors.slice(0, 5).join("; ")}`);
}
```

Errors are logged (capped at 5) and emitted as a count in the event, but no retry, no alert, no escalation. A persistently broken file will generate the same error every 30 minutes forever.

**Impact**: Operator never learns that a file failed to parse. In practice, research sync errors are lost in log noise.

**Recommendation**: (a) Add error persistence — write errors to a `research_sync_errors` table or emit a structured event that gets surfaced in the dashboard. (b) Consider deduplicating — track which files have been erroring and only log new failures.

---

## Finding 5: No Stale Entry Cleanup (Low)

**Evidence**: Sync functions INSERT OR REPLACE entries that exist on disk. If a file is deleted or renamed, its DB row persists forever with an old `synced_at` timestamp. There is no `DELETE FROM knowledge_entries WHERE synced_at < ?` cleanup pass.

**Impact**: DB accumulates ghost entries for deleted/renamed files. Queries against the research tables may return outdated entries. Low severity because the `raw_content` and `synced_at` columns provide enough signal to filter, but it's a data hygiene issue.

**Recommendation**: After syncing all files, delete rows where `synced_at < <this_run_timestamp>`. Must be done inside the same transaction as the upserts (ties back to Finding 1).

---

## Non-Findings (Explicitly Clear)

| Area | Status |
|------|--------|
| SQL injection | ✅ Safe — all queries use `?` parameterized statements |
| NULL in NOT NULL columns | ✅ Safe — `raw_content` always has a value (empty experiment defaults to `[Empty experiment: ${id}]`) |
| Single corrupt row blast radius | ✅ Contained — try/catch per file, one bad file doesn't abort the batch |
| Schema mismatch (column count) | ✅ Safe — INSERT column counts match schema definitions in requests.ts |
| Concurrent access | ✅ Low risk — sync runs on 30min cron, WAL mode handles reader/writer overlap |

---

## Severity Summary

| # | Finding | Severity | Fix Effort |
|---|---------|----------|------------|
| 1 | No transaction wrapping | Medium | Small (wrap in BEGIN/COMMIT) |
| 2 | Duplicate evidence extraction | Low (bug) | Trivial (fix field name) |
| 3 | Corrupt markdown overwrites good data | Medium | Medium (add comparison logic) |
| 4 | Error handling log-and-forget | Low | Small (persist errors) |
| 5 | No stale entry cleanup | Low | Small (DELETE WHERE synced_at < ?) |

**Overall assessment**: research-db.ts is well-structured for its job. No critical fragility. The transaction wrapping (F1) and data quality regression (F3) are worth fixing; the rest are hygiene improvements.
