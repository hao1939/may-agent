# Evaluator heartbeat — 2026-05-03

## Session-eval pipeline liveness / coverage check

Evidence (DB):
- `evaluations.max(createdAt)` = **1777781869693**
- `sessions.max(endedAt)` = **1777783815293**
- lag = **1,945,600 ms (~32.4 min)**
- last 24h: **1745 sessions** vs **45 evaluations**

Top 24h volumes:
- sessions: evaluator 1169, amy 116, coach 98, optimizer 63, tech-lead 57, ...
- evals: coach 15, amy 10, bob 6, arc 4, may 4, dev 3, scout 2, optimizer 1

Interpretation:
- Pipeline appears **alive** (lag ~32 min), but **coverage is low** (45/1745 ~ 2.6%).
- Note mismatch: **evaluator agent** is generating many sessions but **0 evaluations** attributed to evaluator in the last 24h query; likely expected if eval job runs as a different agent identity or is sampling only specific kinds.

Hypotheses to confirm next:
1) `evaluate-session-llm` cron/job scope is intentionally narrow (e.g., only human-facing agents / only certain kinds).
2) Evaluations agent attribution reflects *subject agent* not *evaluator runner*; if so, we should query schema/docs to confirm.
3) Some sessions may be excluded due to status/kind/source filters.

Secondary evidence (legacy artifacts): `.state/evaluations/` newest non-task-tree json mtime is **Apr 29**, while DB has newer evals — consistent with **legacy output path drift** vs pipeline failure.

## Next actions (not executed this heartbeat)
- Locate the evaluation cron / job code and document current sampling rules.
- Propose/implement a coverage metric + target (e.g., evals per 24h / sessions per 24h) and an alert threshold.
