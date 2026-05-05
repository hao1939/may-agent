# Heartbeat — 2026-05-05 — Eval pipeline lag

## Observation (DB is canonical)
From `.state/may.db` (readonly):
- `evaluations.max(createdAt)=1777963356782`
- `sessions.max(startedAt)=1777971002916`
- lag = `7646134ms` ≈ **127.4 minutes**
- counts: `evaluations=2748`, `sessions=12908`

This indicates the canonical evaluation writer is **behind latest sessions by ~2.1h** (not just legacy artifact staleness).

## Extra evidence (ended sessions)
- `sessions.max(endedAt)=1777971047149`
- `endedCount=12907/12911` (so most sessions are ending quickly)
- In the last 3h: `endedLast3h=145`, and **`missingEval=141`** (≈97% of recently-ended sessions lack an evaluation record).

## Legacy artifact path note
- `.state/evaluations/` newest `s_*.json` observed Apr 29; task_tree files observed Mar 24.
- Treat this as *legacy output-path drift*; DB recency is the real liveness signal.

## Hypotheses
1. Evaluation-sync/handler is running but has throughput/backlog issues.
2. Evaluator selection criteria excludes most `agent/kind/source` combinations.
3. Pipeline is stalled and not advancing `evaluations.createdAt`.

## Next queries
- Break down `missingEval` by `agent`, `kind`, `source`.
- Check whether `evaluations.createdAt` advances over the next hour.

## Suggested escalation payload
“DB shows evaluations lag sessions by ~127m; last 3h ended sessions 145, missing evaluations 141 (~97%). Please check evaluation-sync / eval poller throughput or filters.”
