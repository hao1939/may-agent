# Calibration Note — 2026-04-08T03:32Z

## Snapshot
- **DB liveness signal (canonical):** `.state/may.db` has table `evaluations`; `MAX(createdAt)=1775617418077` (see tool output).
- **Legacy artifact path:** `.state/evaluations/` newest mtime still ~2026-03-24.
- **Workspace calibration inputs:** `consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl` are symlinks into `workspace/archive/2026-03/` (no new April data at those paths).

## Interpretation
1. **Session evaluation pipeline appears live in DB** even though `.state/evaluations/` remains stale.
2. **Treat `.state/evaluations/` as legacy output** unless/until a job is confirmed writing there again; DB recency should drive “liveness” judgement.
3. **Calibration streams are currently paused/miswired** (symlinked to March archive), so “no new flags/reviews” is ambiguous: it may mean “no disagreements” or “not collecting new data.”

## Recommendation
- If we expect ongoing calibration: create/point `workspace/*-reviews.jsonl` to an April collection file (or update the process doc to state that these are intentionally frozen archives).
