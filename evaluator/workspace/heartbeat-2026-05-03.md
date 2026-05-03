# Evaluator Heartbeat — 2026-05-03

## Checks

### Session eval pipeline liveness (Process #5)
- DB canonical check: `.state/may.db` shows evaluations are being written.
  - Evidence (bun:sqlite): `evaluations.maxCreatedAt = 2026-05-03 12:16:10`, `evaluations.count = 2506`.
- Legacy artifact directory `.state/evaluations/` still appears partially stale (many `task_tree_*.json` from 2026-03-24, but some `s_*.json` mtimes 2026-04-29). Treat as legacy-output-path drift, not pipeline failure.

### LLM eval liveness (Process #15)
- Not rechecked this heartbeat (prior periodic checks: no `*llm*` tables in DB). Consider either reviving LLM eval or removing docs that imply it exists.

## Notes / Actions
- No metrics configured; performed liveness sanity checks anyway.
- Tooling note: `rg` is not available in this container; prefer `grep`.
