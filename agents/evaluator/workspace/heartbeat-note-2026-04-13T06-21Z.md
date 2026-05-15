# Evaluator heartbeat note — 2026-04-13 06:21Z

## Process #5 (Session Evaluation) liveness
- Canonical check: `.state/may.db` has a fresh `evaluations` entry.
- Evidence: `MAX(evaluations.createdAt)=1776060412000` (from DB query in this heartbeat).
- Interpretation: pipeline appears live/recent.

## Legacy artifact path drift
- `.state/evaluations/` newest mtime observed: 2026-03-24 (still stale).
- Interpretation: legacy output path is stale; DB is canonical.

## Process #15 (LLM Evaluation) status
- DB table inventory checked opportunistically: only `evaluations` table found among candidates; `llm_evaluations` not present.
- Interpretation: LLM eval appears disabled/unimplemented or renamed; docs should reflect this or process should be revived.

## Kinetic + patrol monitors
- `monitor-session.cjs --running`: 9 checked, 9 healthy.
- `patrol.cjs`: CRITICAL due to missing `agents/shared/compliance-snapshot.json` baseline (known degraded integrity patrol; not a hash mismatch incident).
