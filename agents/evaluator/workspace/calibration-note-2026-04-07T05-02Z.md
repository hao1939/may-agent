# Evaluator calibration note — 2026-04-07 05:02Z

## Observations
- `.state/evaluations/` still appears stale; newest artifacts visible via `ls -la .state/evaluations/ | tail -10` are dated **2026-03-24**.
- `monitor-session` shows **9 running sessions, 9 healthy** (no loops/stalls flagged).
- `patrol.cjs` reports **CRITICAL** due to **Missing compliance-snapshot.json** baseline; this is an expected degraded-integrity state rather than an active mismatch incident.

## Calibration actions
- Replace reliance on `rg` in heartbeat scripts/notes: this environment lacks ripgrep (`/bin/bash: rg: command not found`). Use `grep` (or ensure tools that assume `rg` degrade gracefully).

## Implications
- Session-eval pipeline liveness remains an infra question (cron/job runner); avoid misattributing it to per-session evaluator failure.
- Integrity monitoring remains partially blind until `agents/shared/compliance-snapshot.json` is restored; continue treating patrol CRITICAL as baseline-missing unless other evidence indicates tampering.
