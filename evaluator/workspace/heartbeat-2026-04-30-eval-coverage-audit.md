# Heartbeat — 2026-04-30 — evaluation coverage audit

## Signals checked (DB is canonical)

- `evaluations MAX(createdAt)` = `1777565835505` (2026-04-30T16:17:15.505Z)
- `sessions MAX(endedAt)` = `1777565960114` (2026-04-30T16:19:20.114Z)
- Approx lag between newest ended session and newest evaluation: **~2.08 minutes**

Interpretation: **evaluation pipeline is live/fresh** at time of check.

## Coverage snapshot

- `sessions count` = **3083**
- `evaluations count` = **1385**
- Rough coverage = **0.449** (evaluations / sessions)

## Coverage skew by agent (ended sessions)

Lowest coverage agents:
- `evaluator`: ended **994**, evaluated **0**, cov **0.000**
- `tech-lead`: ended **18**, evaluated **5**, cov **0.278**
- `optimizer`: ended **841**, evaluated **383**, cov **0.455**
- `coach`: ended **868**, evaluated **436**, cov **0.502**

Note: other agents are materially higher (e.g. `amy` ~0.872, `bob` ~0.841).

## Hypotheses (to confirm in a follow-up)

1. **Self-evaluation exclusion** is likely filtering out `evaluator` sessions (coverage=0). This is plausible and probably desirable, but it drags aggregate coverage if totals include evaluator sessions.
2. `tech-lead` low coverage may indicate a scope filter in the cron (e.g., only certain agents/kinds/sources). Could be intentional if tech-lead sessions are mostly workflow/infra.

## Suggested next checks

- Identify the eval cron scope filter (JS/cron config) and confirm whether `tech-lead` is excluded intentionally.
- Decide whether overall “Coverage” should exclude `agent='evaluator'` sessions to avoid a misleading KPI.
