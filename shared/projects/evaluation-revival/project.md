# Project: Evaluation Revival

**Status**: active
**Owner**: coach
**Priority**: P0
**Workflow**: master-worker
**Iteration**: 4

## Goal
Restore the evaluation pipeline so agent performance is measured continuously. Without evaluations, the learning flywheel is broken — we can't identify regressions, validate improvements, or train effectively.

## Metrics
- evaluation.sessions-scored-7d: 31 → target ≥10 ✅ (sessions evaluated in last 7 days)
- evaluation.coverage: 0.067 → target ≥0.50 (fraction of completed sessions that get evaluated)

## Current State
**Updated 2026-04-29 (iter 5)**: Pipeline is live with throughput fix deployed. Coaching consumer implemented and registered in cron (every 6h). First coaching intervention generated: optimizer agent flagged for critical quality failure (quality=0.1). End-to-end flow: eval-poller → evaluations → coaching-consumer → coaching-queue ✅. 

Remaining: (1) Wait ~2 days for coverage metric to reflect throughput increase. (2) Wire coach heartbeat to actually consume coaching-queue entries and take action on flagged agents. (3) Add regression guard.

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
- [ ] Validate coverage reaches ≥50% after throughput increase (measure in ~2 days)
- [x] Wire coach heartbeat to consume .state/coaching-queue/ and take action — coaching-dispatcher.ts writes to agent knowledge/, registered in cron
- [ ] Validate coverage reaches ≥50% after throughput increase (measure in ~2 days)
- [ ] Add regression guard: alert if sessions-scored-7d drops below 10
- [ ] Verify optimizer agent actually reads coaching file in next session
- [ ] Re-plan: once coverage ≥50% and coaching loop verified end-to-end

## References
- .state/evaluations/ — existing evaluation outputs (last: Mar 24)
- agents/evaluator/ — evaluator agent config
- agents/shared/cron.json — cron triggers
