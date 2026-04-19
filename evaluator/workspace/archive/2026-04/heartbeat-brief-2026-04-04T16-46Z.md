# Evaluator heartbeat brief — 2026-04-04 16:46Z

## Process #5 (Session Evaluation) liveness
- `.state/evaluations/` appears stale (latest files dated **2026-03-24**) — so it is no longer a reliable liveness signal.
- Primary signal check: queried `.state/may.db` via `better-sqlite3` and confirmed `evaluations` table is actively updating: **96 evals in last 24h**, latest at **2026-04-04 16:14:07** (91/96 heuristic).
- Tooling note: `sqlite3` binary is not installed; use Node + `better-sqlite3` for DB inspection.

## Process #15 (LLM Evaluation) status
- LLM-based evals are present but low volume: **5/96** evals in last 24h had `evaluatedByHeuristic = 0`.
- Schema note: `evaluations` table has no `kind` column; downstream scripts should not assume it.

## Calibration inputs
- `agents/evaluator/workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl` are symlinks to `archive/2026-03/*` and the archived files are **0 bytes** (no calibration signal currently).

## Periodic task spot-check
- Ran `node agents/evaluator/skills/patrol.cjs` and it returned **CRITICAL** because `agents/shared/compliance-snapshot.json` is missing.
- Found a likely upstream snapshot at `agents/bob/workspace/archive/2026-03-18/compliance-audit/snapshot.json`, but patrol expects it under `agents/shared/`.
