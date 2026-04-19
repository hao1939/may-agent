# Calibration Note — 2026-04-06 21:32Z

## Findings
1) **Legacy eval artifacts are stale but DB is live**
- `.state/evaluations/` newest file is dated **Mar 24** (via `ls -la .state/evaluations/ | tail -5`).
- However `.state/may.db` has fresh evaluation writes: `evaluations MAX(createdAt)=2026-04-06T21:03:06.759Z` (queried via Python).
- Conclusion: **do not treat `.state/evaluations/` recency as a liveness check**; DB is the primary signal.

2) **System monitors still show two recurring degradations**
- `patrol.cjs` returns `CRITICAL` due to **Missing compliance-snapshot.json** baseline (degrades integrity monitoring; not necessarily tampering).
- `monitor-session` flagged one `PROTOCOL_VIOLATION` (tech-lead P114 Experience Replay missing) → should be logged as a coaching signal, not a functional outage.

## Recommendation
- Update heartbeat/checklists (or criteria) to prioritize **DB liveness** over legacy artifact directories for process #5 Session Evaluation.
- Track `Missing compliance-snapshot.json` as infra debt; until fixed, interpret patrol `CRITICAL` as "monitor degraded" not "integrity compromised".
