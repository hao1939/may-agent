# Evaluator heartbeat — 2026-05-03

## Session-eval pipeline liveness / coverage check

Evidence (DB is canonical):
- `sessions.max(startedAt)` = `1777794614019`
- `evaluations.max(createdAt)` = `1777792355016`
- lag = `2259003 ms` (~37.7 minutes)
- last hour: `sessions=69`, `evaluations=1` → **coverage ~1.45%**

Tool evidence:
- python query: sessions/evaluations max + lag (ms)
- python query: last-hour counts + coverage

## Interpretation
- The evaluation writer is not fully dead (1 eval in last hour), but it is severely behind / under-sampling relative to session volume.
- Legacy `.state/evaluations/` contains recent `s_*.json` mtimes (Apr 29) while task_tree artifacts are stale (Mar 24), consistent with known drift.

## Recommendation / escalation target
- Treat as process #5 (Session Evaluation) degradation: either cron schedule too sparse, backlog stuck, or scope narrowed.
- Next step: inspect cron/job runner logs/config for `evaluate-session-llm` frequency and whether it is skipping sessions.
