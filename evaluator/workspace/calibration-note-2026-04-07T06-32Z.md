# Evaluator Calibration Note — 2026-04-07 06:32Z

## Observations (structural)
- `.state/evaluations/` appears **stale**: newest files shown by `ls -la .state/evaluations/ | tail -10` are dated **2026-03-24**.
- `monitor-session.cjs --running` reports **9 running sessions, 9 healthy**.
- `patrol.cjs` reports **CRITICAL** due to **Missing compliance-snapshot.json** baseline (integrity patrol degraded; not evidence of an active hash mismatch).
- Workspace calibration notes exist through 2026-04-07T05:02Z; no new consistency/human-review flags observed here (the flag files are symlinks into archive/2026-03).

## Implication for scoring signal consumers
- Treat evaluation-artifact staleness as **pipeline liveness / cron** issue, not as a per-session evaluation failure.
- Continue to treat `patrol.cjs:CRITICAL` as **infrastructure degraded** until `agents/shared/compliance-snapshot.json` is restored/seeded.

## Suggested next actions (owners)
- **Bob / Infra**: restore or generate `agents/shared/compliance-snapshot.json` baseline so patrol can distinguish real integrity drift from missing-baseline.
- **May / Cron owner**: check whether `evaluate-session-llm` cron is still scheduled/enabled; if disabled, decide revive vs retire.
