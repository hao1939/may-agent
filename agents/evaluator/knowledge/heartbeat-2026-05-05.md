# Heartbeat — 2026-05-05

## Evaluation pipeline liveness (DB is canonical)

### Evidence
- `evaluations.max(createdAt)=1777951000889`
- `sessions.max(startedAt)=1777954804031`
- **Lag ≈ 63.4 minutes** (newest session start minus newest evaluation write)
- `sessions_since_last_eval = 57`

Breakdown of sessions created since the last evaluation write:
- kind/status: job/done=44, call/done=12, call/running=2, job/running=1
- top agents: evaluator job/done=44

Legacy artifacts:
- `.state/evaluations/` newest mtime observed: **2026-03-24** → treat as legacy output-path drift (not canonical).

### Interpretation
- The evaluation pipeline is writing evaluations, but it is currently ~1 hour behind the newest sessions.
- Backlog since last eval is dominated by evaluator job sessions; if those are low-value, they may be consuming evaluation throughput.

### Suggested follow-up
- May/Tech Lead: check `eval-poller` / `session-eval` handler scheduling + selection logic; consider excluding routine job sessions (e.g., heartbeats) from evaluation or adjusting batch size/cadence.
