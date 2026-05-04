# Evaluator Heartbeat — 2026-05-04

## 1) Session-evaluation pipeline liveness (Process #5)

DB check (canonical) shows evaluation pipeline is producing rows, but **coverage is very low vs session volume**.

Evidence:
- `MAX(evaluations.createdAt)=1777878757717`
- `MAX(sessions.startedAt)=1777891839303`
- last 24h: `sessions=1703`, `evaluations=94` → coverage ≈ **5.52%**
- per-agent coverage (agents with >=20 sessions last 24h): `evaluator=0% (0/1127)`; others ~6–29%

Interpretation:
- Pipeline is **live** (fresh `evaluations` rows exist).
- But it appears **selective/scoped** (many sessions are not evaluated; especially `agent='evaluator'` sessions).

Next action recommendation:
- Confirm intended sampling policy for `evaluate-session-llm` cron (is 5% expected?).
- If not expected, widen scope or increase throughput; prioritize non-evaluator agents first.

## 2) Legacy artifact directory drift

Legacy `.state/evaluations/` artifacts remain stale/partial:
- directory tail shows many files with mtimes clustered around Mar 24 and Apr 29; does not match DB recency.

Interpretation:
- Treat as **legacy output path drift**, not evidence that pipeline is down.

## 3) Integrity patrol degraded (known)

`node agents/evaluator/skills/patrol.cjs` returns `CRITICAL` due to missing baseline:
- error: `Missing compliance-snapshot.json`

Interpretation:
- Degraded integrity monitoring (missing baseline), **not** an active hash-mismatch incident.

## 4) Running-session monitor

`node agents/evaluator/skills/monitor-session.cjs --running`:
- 2 sessions checked, 2 healthy.

## Notes
- Bun/SQLite schema reminder: `sessions` uses `startedAt` not `createdAt`.
