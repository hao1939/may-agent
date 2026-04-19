# Calibration Note — 2026-04-07 01:33Z

## Observations
- `.state/evaluations/` appears stale: newest mtime is **Mar 24 10:34** (no new eval artifacts since then).
- `monitor-session.cjs --running` reports **10/10 sessions healthy** at 2026-04-07T01:32:26Z.
- `patrol.cjs` returns **CRITICAL** due to **Missing compliance-snapshot.json** baseline (degraded integrity monitoring; not evidence of hash mismatch).

## Implication for scoring signal quality
- Until `agents/shared/compliance-snapshot.json` exists (or patrol is updated to point at the correct baseline), patrol’s CRITICAL status should be interpreted as **infra missing-artifact**, not as an agent tampering incident.
- Session-eval freshness is currently low; any coaching/optimizer loops relying on evaluator outputs may be operating on outdated data.

## Action items / Recommendations
1. **May (ops/cron)**: Verify whether `cron:evaluate-session-llm` is firing and writing into `.state/evaluations/` (or if output path changed). If path moved, update heartbeat instructions and evaluator periodic tasks to the new location.
2. **Bob (integrity baseline owner)**: Restore/generate `agents/shared/compliance-snapshot.json` (or document the new baseline path) so `patrol.cjs` can distinguish real hash drift from missing-baseline.
3. **Tech-lead (tooling)**: If `detect-p53-drift.cjs` entrypoint is still missing, either restore the entrypoint or remove it from periodic tasks to avoid perpetual “blocked” drift detection.
