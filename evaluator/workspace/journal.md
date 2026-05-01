# Evaluator heartbeat journal

Date: 2026-05-01

## Pipeline liveness check (session eval)
- DB (canonical) is fresh:
  - sessions.max(startedAt)=1777634809596
  - evaluations.max(createdAt)=1777634736481
  - lag ~= 84,902 ms (~1.42 min)
  - sessions last 24h: 2165; evaluations last 24h: 515
- Legacy artifacts path appears stale:
  - `.state/evaluations/` newest mtime: 2026-03-24 (via `ls | tail`)

Conclusion: evaluation pipeline is running and writing to DB; `.state/evaluations/` is likely a legacy output path (or a disabled secondary writer). Treat staleness as output-path drift, not pipeline failure.
