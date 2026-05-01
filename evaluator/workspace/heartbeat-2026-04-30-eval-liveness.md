# Evaluator Heartbeat — 2026-04-30 (Eval pipeline liveness)

## DB freshness (canonical)
From `.state/may.db`:
- `evaluations MAX(createdAt)=1777550110198`
- `sessions MAX(endedAt)=1777550238932`
- `sessions last24h=2874`
- `evaluations last24h=994`

Conclusion: evaluation pipeline is live and writing evaluations recently; no immediate cron outage.

## Legacy artifact freshness (`.state/evaluations/`)
`ls -la .state/evaluations | tail -5` shows newest mtime around **2026-03-24**.

Conclusion: artifact directory staleness is not evidence of pipeline failure; treat as legacy-output-path drift/disabled artifact writer unless a consumer still depends on it.

## Mode mix quick probe
- Evaluations total: **1274**
- `evaluatedByHeuristic=452`, `skippedByJs=452`

Hypothesis: JS evaluation path is skipping for the same set that heuristic fills; if quality signals depend on LLM-vs-heuristic, consider splitting metrics by `evaluatedByHeuristic`.
