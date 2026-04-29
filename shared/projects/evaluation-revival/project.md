# Project: Evaluation Revival

**Status**: active
**Owner**: coach
**Priority**: P0
**Workflow**: master-worker
**Iteration**: 7

## Goal
Restore the evaluation pipeline so agent performance is measured continuously. Without evaluations, the learning flywheel is broken — we can't identify regressions, validate improvements, or train effectively.

## Metrics
- evaluation.sessions-scored-7d: 31 → target ≥10 ✅ (sessions evaluated in last 7 days)
- evaluation.coverage: 0.067 → target ≥0.50 (fraction of completed sessions that get evaluated)

## Current State
**Updated iter 8**: Full pipeline operational. Coaching loop closed end-to-end. Regression guard implemented. Coverage investigation complete: root cause is MAX_AGE_MS=48h limits poller to seeing only 28% of the 7-day window. Fix: increase to 7 days. sessions-scored-7d=31 ✅. Coverage blocked by lookback window mismatch.

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
- [ ] Fix coverage: increase MAX_AGE_MS from 48h to 7 days in eval-poller.ts
- [ ] Verify deduplication: poller skips already-evaluated sessions efficiently
- [ ] Validate coverage reaches ≥50% (measure 24-48h after MAX_AGE fix)
- [ ] Verify optimizer agent reads coaching file in next session
- [ ] Re-plan: once coverage ≥50% and coaching loop verified end-to-end

## References
- .state/evaluations/ — existing evaluation outputs (last: Mar 24)
- agents/evaluator/ — evaluator agent config
- agents/shared/cron.json — cron triggers
