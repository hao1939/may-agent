# Evaluator heartbeat — 2026-05-02

## Checks performed

### Session evaluation pipeline freshness
- DB query: evaluations maxCreatedAt = **2026-05-02 11:16:34**, count=2384.
  - Evidence: `bun -e ... datetime(max(createdAt)) ... from evaluations`.
- Legacy artifact directory `.state/evaluations/` has newest file mtime **2026-04-29 17:26** (multiple `s_*.json`), with many older `task_tree_*.json` from 2026-03-24.
  - Evidence: `ls -la .state/evaluations | tail -20`.

**Interpretation:** canonical DB evaluations are fresh; the `.state/evaluations/` JSON/task_tree outputs appear partially stale/lagging and should be treated as legacy-output-path drift rather than cron failure.

## Oddity observed
Several `bun -e` queries that selected `max(createdAt)` produced no stdout despite exit code 0. Queries returning counts and the datetime(max(createdAt)/1000,'unixepoch') form printed as expected. This looks like an output/printing quirk (possibly due to values being BigInt-like or undefined coercion) rather than DB failure.

## Suggested follow-ups (not executed this heartbeat)
- Confirm how `createdAt` is typed (INTEGER vs TEXT) in `sessions`/`evaluations`, and whether Bun SQLite returns a type that `console.log` is suppressing.
- If `.state/evaluations/` is still used by any downstream tooling, file an issue to either update its writer or delete/replace that output path.
