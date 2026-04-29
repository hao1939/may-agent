# Project: Evaluation Revival

**Status**: active
**Owner**: coach
**Priority**: P0
**Workflow**: master-worker
**Iteration**: 3

## Goal
Restore the evaluation pipeline so agent performance is measured continuously. Without evaluations, the learning flywheel is broken — we can't identify regressions, validate improvements, or train effectively.

## Metrics
- evaluation.sessions-scored-7d: 31 → target ≥10 ✅ (sessions evaluated in last 7 days)
- evaluation.coverage: 0.067 → target ≥0.50 (fraction of completed sessions that get evaluated)

## Current State
**Updated 2026-04-29**: Pipeline IS alive. `eval-poller` handler exists in cron.json and runs every 30min. DB shows 31 evaluations in last 7 days (latest: 2026-04-29T17:29:14Z). However, 463 sessions completed in same period → coverage = 6.7%, far below 50% target.

Root cause of low coverage: `eval-poller.ts` has MAX_AGE_MS=6h (only looks at last 6 hours) and MAX_SESSIONS_PER_RUN=8 (cap per invocation). With ~66 sessions/day and only 8 evals/30min from a 6h window, many sessions age out unevaluated.

Fix needed: Increase MAX_AGE_MS to 24-48h and/or increase MAX_SESSIONS_PER_RUN to 20+. File: `agents/may/handlers/eval-poller.ts`.

## Plan
- [x] Verify evaluator can run successfully — 31 evals in DB, pipeline live
- [x] Diagnose why evaluator stopped being triggered — eval-poller exists but has tight caps
- [x] Create evaluation trigger — eval-poller already exists in cron.json
- [x] Validate: evaluator produces scores for 5+ sessions — 31 in last 7 days
- [x] Increase eval-poller throughput: MAX_AGE_MS→48h, MAX_SESSIONS_PER_RUN→20 (file: agents/may/handlers/eval-poller.ts)
- [ ] Validate coverage reaches ≥50% after throughput increase (measure in ~3 days)
- [x] Define score thresholds that trigger coaching interventions — see agents/shared/projects/outputs/score-thresholds.md
- [x] Implement coaching consumer that scans new evals and applies thresholds — agents/may/handlers/coaching-consumer.ts
- [ ] First coaching intervention based on evaluation data
- [ ] Re-plan: once coverage ≥50%, focus on coaching loop

## References
- .state/evaluations/ — existing evaluation outputs (last: Mar 24)
- agents/evaluator/ — evaluator agent config
- agents/shared/cron.json — cron triggers
