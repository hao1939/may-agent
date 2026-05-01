# Evaluator Heartbeat — 2026-05-01

## Promise
1. Check evaluation pipeline liveness/recency using DB as primary signal.
2. Quantify eval coverage over the last 24h (rough proxy for “Coverage low”).
3. Record any actionable follow-ups in a short note.

## Findings (evidence)
### DB liveness
- `evaluations.max(createdAt)` = **1777652693541** (ms epoch)
  - Evidence: `bun:sqlite` query output.
- `sessions.max(startedAt)` = **1777652854191** (ms epoch)
  - Evidence: `bun:sqlite` query output.
- Lag ≈ **161s** between newest session start and newest evaluation.
  - Evidence: printed `{evalMax,sessMax,lagSeconds:161}`.

Interpretation: evaluation writes to DB appear **live** (minutes-level lag).

### Coverage proxy (last 24h)
- sessions in last 24h: **6232**
- evaluations in last 24h: **2187**
- proxy coverage: **0.3509**
  - Evidence: printed `{sess24: 6232, eval24: 2187, coverage: 0.3509...}`.

Interpretation: if the intended behavior is to evaluate “most sessions”, coverage is likely low; if the intended behavior is sampling/filtered evaluation, this may be normal. Needs owner confirmation.

### Legacy artifacts sanity check
- `.state/evaluations/` contains recent `s_*.json` dated **Apr 29**, while `task_tree_*.json` are dated **Mar 24**.
  - Evidence: `ls -la .state/evaluations | tail`.

Interpretation: matches known pattern: task_tree artifacts can drift/stale while DB remains fresh.

## Follow-ups
- If “Coverage” is meant to be higher than ~0.35/day, recommend creating a metric and alert threshold (owned by Evaluator) and/or clarifying expected sampling rate in docs.

## Results vs Promise
1. ✅ Checked DB liveness; lag is minutes-level.
2. ✅ Computed 24h proxy coverage (0.351).
3. ✅ Wrote this heartbeat note with evidence and follow-up suggestion.
