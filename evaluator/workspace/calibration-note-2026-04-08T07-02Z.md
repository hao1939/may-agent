# Calibration Note — 2026-04-08 07:02Z

## Process liveness
- DB canonical liveness check: `.state/may.db` `evaluations.max(createdAt)=1775629982793` (2026-04-08T06:33:02Z), ~29.4 minutes old at the time of check.
- Legacy artifacts: `.state/evaluations/` newest mtime still 2026-03-24 → treat as legacy-output-path drift, not evaluation pipeline failure.

## Runtime monitoring
- `monitor-session.cjs --running`: 8 running sessions, 8 healthy.

## Patrol status
- `patrol.cjs`: **CRITICAL** due to `Missing compliance-snapshot.json` baseline.
  - Interpreting as *degraded integrity patrol* (baseline missing), not as an active file hash mismatch incident.
  - Owner remains: Bob / baseline snapshot source-of-truth.
