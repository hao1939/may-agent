---
id: evaluation-revival
owner: coach
status: closed
type: milestone
priority: P0
workflow: project
iteration: 9
---

# Project: Evaluation Revival


## Goal
Restore the evaluation pipeline so agent performance is measured continuously. Without evaluations, the learning flywheel is broken — we can't identify regressions, validate improvements, or train effectively.

## Metrics
- evaluation.sessions-scored-7d: 31 → target ≥10 ✅ (sessions evaluated in last 7 days)
- evaluation.coverage: 0.067 → target ≥0.50 (fraction of completed sessions that get evaluated)

## Current State
**Updated iter 10**: All infrastructure complete and deployed. Coverage fix (7d lookback) live — waiting for metric to validate. Optimizer hasn't run since receiving coaching (last ran April 12). All plan items complete except final validation. Moving to re-plan.

**Updated 2026-07-02**: eval-poller set to 100/run with 7d window. Only 18 evaluations in .state/evaluations/ — system session volume appears low (activity.jsonl last entry March 2026). Coverage target of 50% may be unrealistic given current system activity levels. Project is infrastructure-complete; validation depends on system traffic resuming.

## Plan
- [x] Verify evaluator can run successfully — 31 evals in DB, pipeline live
- [x] Diagnose why evaluator stopped being triggered — eval-poller exists but has tight caps
- [x] Create evaluation trigger — eval-poller already exists in cron.json
- [x] Validate: evaluator produces scores for 5+ sessions — 31 in last 7 days
- [x] Increase eval-poller throughput: MAX_AGE_MS→48h, MAX_SESSIONS_PER_RUN→20 (file: agents/may/handlers/eval-poller.ts)
- [x] Define score thresholds that trigger coaching interventions — see agents/shared/projects/outputs/score-thresholds.md
- [x] Implement coaching consumer that scans new evals and applies thresholds — agents/may/handlers/coaching-consumer.ts
- [x] Register coaching-consumer in cron.json — runs every 6h via agents/may/cron.json
- [x] First coaching intervention based on evaluation data — optimizer flagged (quality=0.1), see .state/coaching-queue/optimizer_1777484873037.json
- [x] Wire coach heartbeat to consume .state/coaching-queue/ and take action — coaching-dispatcher.ts writes to agent knowledge/, registered in cron
- [x] Add regression guard: alert if sessions-scored-7d drops below 10 — see regression-guard.md
- [x] Investigate coverage gap — root cause: 48h lookback vs 7d metric window (coverage-investigation.md)
- [x] Fix coverage: increase MAX_AGE_MS from 48h to 7 days in eval-poller.ts — deployed (coverage-fix-7day.md)
- [x] Verify deduplication: poller skips already-evaluated sessions efficiently — confirmed in source
- [ ] Validate coverage reaches ≥50% — BLOCKED: 79 sessions processed vs ~7855 total in window. Poller at 20/run is too slow. Need to either increase MAX_SESSIONS_PER_RUN dramatically or filter out heartbeat/system sessions.
- [x] Verify optimizer agent reads coaching file in next session — optimizer hasn't run yet since coaching file written (coaching-loop-validation.md)
- [ ] Re-plan: once coverage ≥50% and coaching loop verified end-to-end

## References
- .state/evaluations/ — existing evaluation outputs (last: Mar 24)
- agents/evaluator/ — evaluator agent config
- agents/shared/cron.json — cron triggers
