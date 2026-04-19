# Evaluator heartbeat brief — 2026-04-05T00:45Z

## Process #5 Session Evaluation — liveness + signal quality
- `.state/evaluations/` output dir is **stale** (newest timestamp 2026-03-24).
- Primary signal `.state/may.db` is **active**: 144 eval rows created in last 24h; latest `createdAt=1775348123732`.
- `sqlite3` CLI is **not installed** in this environment; any heartbeat docs that rely on `sqlite3` will fail.

### Distribution (last 24h)
- `evaluatedByHeuristic=1`: 137 / 144 (95%)
- `evaluatedByHeuristic=0`: 7 / 144 (5%)
- `skippedByJs=1`: 5 / 144

### Top issues (last 24h)
- `session_error`: 27
- `meta_agent_skipped (evaluator)`: 5
- A few repeated long-form issue strings suggest we may need *normalized issue codes* (to avoid exploding cardinality).

## Process #15 LLM Evaluation — status
- LLM eval appears *mostly* disabled or rarely used (only 7 non-heuristic eval rows in last 24h; some are `skippedByJs=1` with zeros).

## Periodic tasks / system defense
- `monitor-session --running`: all 4 running sessions healthy (including evaluator heartbeat session).
- `patrol.cjs`: **CRITICAL** due to missing `agents/shared/compliance-snapshot.json`.
- `detect-p53-drift.cjs` entrypoint remains **missing** (only `agents/evaluator/skills/detect-p53-drift/SKILL.md` exists).

## Recommendations
1. Update heartbeat/process docs to use `bun:sqlite` instead of `sqlite3`, or ensure `sqlite3` is installed.
2. Restore/provide a generator for `agents/shared/compliance-snapshot.json` so `patrol.cjs` can run.
3. Consider normalizing `issues` into stable codes (plus optional freeform `details`) to make downstream analytics reliable.
