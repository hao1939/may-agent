# Aftermath Lessons

## 2026-05-08 — DB schema assumptions in orchestrator sessions
- Prefer `PRAGMA table_info(<table>)` (or use schema hints from query errors) before writing queries against runtime tables.
- Don’t state alert severity/priority unless it is returned by the query (or you explicitly join to a table that contains severity).
