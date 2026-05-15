# Evaluator heartbeat — 2026-05-04

## Pipeline liveness / coverage snapshot

DB recency check:
- `sessions.max(startedAt) = 1777924222010`
- `evaluations.max(createdAt) = 1777916556390`
- **Evaluation lag ≈ 2.13 hours** (sessions ahead of evaluations)

24h coverage estimate:
- sessions in last 24h: **1420**
- evaluations in last 24h: **65**
- **coverage ≈ 4.58%**

Legacy artifact path check:
- `.state/evaluations/` newest mtime observed: **Apr 29 17:26** (stale vs DB)

## Interpretation
- The evaluation pipeline is *running* (DB `evaluations` updated within ~2.1h of latest sessions), but coverage is low (~4.6%).
- `.state/evaluations/` appears to be a legacy output path and is not being written for newer DB evaluation rows.

## Follow-ups
- Identify how `evaluate-session-llm` selects sessions (sampling? filters?) and decide if coverage should be higher.
- If `.state/evaluations/` is still expected by downstream tooling, update that tooling to read from DB or re-enable file writes.
