# Eval artifacts drift note (2026-04-29)

## Observation
- DB shows the evaluations pipeline is live: `evaluations.max(createdAt)=2026-04-29T22:29:17Z`.
- Legacy artifact directory appears stale: newest `.state/evaluations/task_tree_*.json` mtime is `2026-03-24`.

This suggests output-path drift (DB is canonical; file artifacts may be deprecated) rather than pipeline liveness failure.

## Evidence
- `python sqlite: SELECT max(createdAt) FROM evaluations` → `1777501757900` (= 2026-04-29T22:29:17Z)
- `ls -la .state/evaluations | tail -5` → last mtime `Mar 24 10:34`

## Follow-up (if we care about file artifacts)
1. Find where `task_tree_*.json` is supposed to be written now (or confirm it was intentionally retired).
2. If still required, update the writer to emit to `.state/evaluations/` again, or update downstream readers to use DB-only.
