# P1 Alert Triage — Heuristic eval bug: quality=0.20 constant

**Alert**: `agent.notification` — [P1] Heuristic eval bug — all heuristic evaluations return `quality=0.20` regardless of actual session.

## What I checked (evidence)

### 1) Evaluation pipeline liveness (DB is canonical)
- `evaluations MAX(createdAt)` = **2026-04-30 20:17:16**.
  - Evidence: bash query showed `evaluations max dt: 2026-04-30 20:17:16`.
- Legacy artifact directory `.state/evaluations/` has newest mtime **2026-03-24**, indicating **legacy output-path drift**, not necessarily pipeline failure.
  - Evidence: `ls -la .state/evaluations | tail -5` showed latest files dated Mar 24.

### 2) Is `quality=0.20` common / constant?
From `.state/may.db`:
- Total rows in `evaluations`: **1494**
- Rows with `quality == 0.2`: **525**
- Most frequent quality values: `0.2` (525), then `0.55` (100), `0.25` (89), ...
  - Evidence: SQL aggregation over `evaluations`.

So: **not all** evaluations are 0.20, but **a large fraction** are.

### 3) What do the 0.20 rows look like?
Verdict + flags for `quality=0.2`:
- verdict breakdown: `needs_improvement` = **525** (all of them)
- flag breakdown:
  - `(evaluatedByHeuristic=1, skippedByJs=1)` = **456**
  - `(evaluatedByHeuristic=0, skippedByJs=0)` = **69**
  - Evidence: grouped queries by verdict and flags.

Additional key distribution signal:
- Entire DB seems to only contain two flag combos:
  - `(skippedByJs=0, evaluatedByHeuristic=0)` = **1041**
  - `(skippedByJs=1, evaluatedByHeuristic=1)` = **456**
- There are **0** rows with `(evaluatedByHeuristic=1, skippedByJs=0)`.
  - Evidence: `SELECT skippedByJs, evaluatedByHeuristic, COUNT(*) ...`.

This strongly suggests a pipeline/flagging bug: heuristic-evaluated rows are being marked as skipped, and/or the heuristic write-path is absent/overwritten.

## Likely root cause candidates (ranked)

1) **Heuristic pipeline path not writing** (or removed), leaving only:
   - LLM evaluator writes: `evaluatedByHeuristic=0, skippedByJs=0`
   - Skip-path writes: `evaluatedByHeuristic=1, skippedByJs=1`

2) **Constant-score branch in heuristic evaluator for skipped sessions**
   - The 0.20 cluster aligns with skip-flagged rows; 0.20 may be the default/min quality for "skipped".

3) **Overwriting bug / INSERT OR REPLACE**
   - Previously known issue: LLM evaluation overwrote `evaluatedByHeuristic` (see optimizer finding 2026-04-18). That would not alone explain `(1,1)` being the only heuristic-ish combo, but it indicates the evaluation table is sensitive to overwrite order.

## Impact
- Dashboard/alerts interpreting `quality=0.20` as genuine low-quality sessions are likely **misled** for the 456 skipped rows.
- Also, adoption metrics and any analysis that assumes `evaluatedByHeuristic=1` means "heuristic ran" is likely broken right now.

## Recommended next steps (delegate)

1) **Identify the writer for `skippedByJs` and the heuristic write-path**.
   - Find where `skippedByJs` is set, and confirm expected combos include `(evaluatedByHeuristic=1, skippedByJs=0)`.

2) **Confirm what 0.20 means in current code**.
   - Locate heuristic scoring constants (e.g., base quality for skipped), and verify why 0.20 is produced.

3) **Fix pipeline so heuristic evals actually run and persist**, and ensure LLM upgrades do not clobber the heuristic-run flag (if that flag is still required for metrics).

---

## Appendix: raw SQL queries used

```sql
SELECT COUNT(*) FROM evaluations;
SELECT quality, COUNT(*) c FROM evaluations GROUP BY quality ORDER BY c DESC LIMIT 10;
SELECT COUNT(*) FROM evaluations WHERE abs(quality-0.2)<1e-9;
SELECT verdict, COUNT(*) FROM evaluations WHERE abs(quality-0.2)<1e-9 GROUP BY verdict;
SELECT evaluatedByHeuristic, skippedByJs, COUNT(*) FROM evaluations WHERE abs(quality-0.2)<1e-9 GROUP BY evaluatedByHeuristic, skippedByJs;
SELECT skippedByJs, evaluatedByHeuristic, COUNT(*) FROM evaluations GROUP BY skippedByJs, evaluatedByHeuristic;
```
