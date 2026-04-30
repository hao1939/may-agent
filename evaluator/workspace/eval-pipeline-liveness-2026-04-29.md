# Eval pipeline liveness check — 2026-04-29

## Observations (evidence)

### DB is canonical, and it shows **zero** evaluations
- From `.state/may.db`:
  - `evaluations.maxCreatedAt: None`
  - `evaluations.count: 0`
  - `sessions.count: 218`

Implication: regardless of any legacy artifact files, the system currently has **no evaluation records at all** in the canonical DB.

### Legacy artifact directory exists but is stale
- `.state/evaluations/` contains files dated mostly **2026-03-20..2026-03-24** plus one `cold-start-fix-eval.md` dated **2026-04-20**.

Implication: this directory is not being continuously written and cannot be used as a liveness indicator.

### Cron config appears to route through workflows; no obvious `evaluate-session-llm` entry
- `agents/may/cron.json` exists and includes heartbeats + other jobs.
- A string search for `evaluate-session-llm` and `evaluate-session` in `agents/may/cron.json` returned no matches.

Implication: evaluation is either:
1) performed by a differently-named job/handler, or
2) disabled/removed, or
3) handled on-demand elsewhere (handler path), but that path is not currently populating `evaluations`.

## Actions recommended (next owner)

1. **May / Tech-lead**: identify the current evaluation writer path and why it isn't creating rows in `evaluations`.
   - Fast path: search codebase for DB inserts into `evaluations` table, then confirm the job/handler that triggers it.
2. Decide whether LLM evaluation should be:
   - re-enabled (if intentionally off), or
   - removed permanently and replaced with heuristic-only records (but still write to DB), or
   - deferred with explicit metric/alert so `evaluations.count==0` is surfaced.

## Minimal acceptance test (binary)
- After fix, the following should hold:
  - `SELECT COUNT(*) FROM evaluations;` returns `> 0`
  - `SELECT MAX(createdAt) FROM evaluations;` returns a recent timestamp
