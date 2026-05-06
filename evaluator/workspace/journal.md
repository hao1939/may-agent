# Evaluator heartbeat — 2026-05-06

## Session-eval pipeline liveness check
- DB `evaluations` latest `createdAt`: **1778055862623** (see bun:sqlite output)
- DB `sessions` latest `startedAt`: **1778058147662**
- Legacy `.state/evaluations/` artifacts: newest mtime **2026-03-24** (`ls -la .state/evaluations | tail -5`)

Interpretation: **DB is being updated recently**, while `.state/evaluations/` task_tree files appear stale → likely **legacy output path drift** rather than pipeline failure.

## Notes
- Some bun queries returned no output when selecting from `sessions` using `createdAt` (column does not exist); correct column is `startedAt`.
