# Calibration note — 2026-05-03 — evaluation coverage + pipeline signals

## What I measured (DB = canonical)

### Evaluation pipeline liveness
- Evaluations are being written recently:
  - `evaluations.max(createdAt)` = **1777790796315**
  - As UTC: **2026-05-03 06:46:36**
  - Evidence: query output in heartbeat transcript.

### Coverage (done sessions vs evaluated)
- `sessions(status='done', agent != 'evaluator')` = **6383**
- Of those, sessions with a matching `evaluations` row = **2147**
- Coverage = **0.33636** (~33.6%)
  - Evidence: `select count(*) done, sum(case when e.sessionId is not null then 1 else 0 end) evaluated ...`

### Missing evaluations (absolute + distribution)
- Missing evaluations for done sessions (non-evaluator agents): **4236**
- Missing oldest `endedAt`: **1777471590617**
- Missing newest `endedAt`: **1777791019145**
- Missing by agent (top):
  - optimizer: 1757
  - coach: 1150
  - amy: 817
  - tech-lead: 110
  - may: 102
  - scout: 89
  - arc: 81
  - bob: 76
  - dev: 45
  - qa: 9

## Interpretation
- The evaluator pipeline is **alive** (recent writes), but **coverage is low** (only ~1/3 of done sessions get evaluated).
- `.state/evaluations/` contains some recent `s_*.json` rows (Apr 29) but task_tree artifacts remain stale (Mar 24), consistent with **legacy artifact path drift** rather than a liveness failure.

## Likely causes (hypotheses)
1) Scope/filters: evaluator intentionally only evaluates a subset (e.g., only selected agents, only sessions above a call threshold, only certain kinds/sources).
2) Throughput limits: backlog grows faster than evaluation cron can process.
3) Persistent skipping: a JS-side skip gate is excluding many sessions.

## Follow-ups to assign
- Find current skip/scope logic in the `evaluate-session-llm` job and document it.
- Decide on an explicit target for evaluation coverage (e.g., 0.8 of done sessions) and add a metric.
- If skips are intended, ensure the dashboard/alerts reflect “skipped intentionally” vs “missing evaluation”.
