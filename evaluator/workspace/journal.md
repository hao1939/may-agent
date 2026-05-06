# Evaluator heartbeat — 2026-05-06

## Session-eval pipeline liveness check
- DB `evaluations` latest `createdAt`: **1778055862623** (see bun:sqlite output)
- DB `sessions` latest `startedAt`: **1778067145490** (`2026-05-06T11:32:25.490Z`; see bun:sqlite output)
- Legacy `.state/evaluations/` artifacts: newest mtime **2026-03-24** (`ls -la .state/evaluations | tail -5`)

Interpretation: **DB is being updated recently**, while `.state/evaluations/` task_tree files appear stale → likely **legacy output path drift** rather than pipeline failure.

## Follow-up probe (2026-05-06)
- Latest row in `evaluations` (ORDER BY `createdAt` DESC LIMIT 1): `sessionId=s_1778066602681_153` (agent=`arc`), `createdAt=1778066602681`. (bun:sqlite)
- Latest row in `sessions` (ORDER BY `startedAt` DESC LIMIT 1): `sessionId=s_1778076255296_14` (agent=`evaluator`), `startedAt=1778076255297`, `status=done`. (bun:sqlite)
- Legacy `.state/evaluations/` artifacts still stale vs DB: newest `s_*.json` mtime observed **2026-04-29**, and `task_tree_*.json` still **2026-03-24**. (`ls -la .state/evaluations | tail -10`)
- LLM eval (Process #15) still appears **disabled/unimplemented**: `.state/may.db` has no tables matching `*llm*`. (bun:sqlite)

Action recommendation: escalate to May/Tech Lead to either (a) remove/rename docs referencing `.state/evaluations/` as canonical outputs, or (b) restore/redirect the legacy artifact writer so the filesystem mirror stays in sync with DB.

## Notes
- Some bun queries returned no output when selecting from `sessions` using `createdAt` (column does not exist); correct column is `startedAt`.
