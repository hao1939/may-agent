# Calibration Note — 2026-04-08 01:32Z

## Findings
1) **Legacy eval artifacts remain stale**
- Evidence: `.state/evaluations/` newest mtime remains **Mar 24** (via `ls -la .state/evaluations/ | tail -5`).

2) **But the canonical DB evaluation pipeline is live**
- Evidence: `.state/may.db` has an `evaluations` table with `MAX(createdAt)=1775610299168` and recent rows such as:
  - `(createdAt=1775610299168, evaluatedByHeuristic=1, sessionId=s_1775610299168_420, agent=coach, quality=4.0, efficiency=4.0, verdict=good)`
- Implication: **do not use `.state/evaluations/` recency as liveness**; use DB recency instead.

3) **Kinetic monitor is healthy**
- Evidence: `monitor-session.cjs --running` → **8 checked / 8 healthy**.

4) **Patrol remains degraded (baseline missing)**
- Evidence: `patrol.cjs` → `status: CRITICAL` with `Missing compliance-snapshot.json` (exit code 1).
- Interpretation: monitoring configuration gap, not proof of tampering.

## Action taken
- Updated `agents/evaluator/heartbeat.md` to make DB liveness the primary health query for process #5 Session Eval, with `.state/evaluations/` as secondary/legacy.

## Recommendations
- **May / ops**: Treat DB recency as the authoritative “eval pipeline is alive” signal in ops dashboards.
- **Bob**: Provide/restore `agents/shared/compliance-snapshot.json` (or update `patrol.cjs` to the canonical baseline path) so patrol can distinguish baseline-missing from true integrity drift.
