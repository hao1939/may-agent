# Project: Evaluation Revival

**Status**: active
**Owner**: coach
**Priority**: P0
**Workflow**: master-worker
**Iteration**: 1

## Goal
Restore the evaluation pipeline so agent performance is measured continuously. Without evaluations, the learning flywheel is broken — we can't identify regressions, validate improvements, or train effectively.

## Metrics
- evaluation.sessions-scored-7d: 0 → target ≥10 (sessions evaluated in last 7 days)
- evaluation.coverage: 0 → target ≥0.50 (fraction of completed sessions that get evaluated)

## Current State
Last evaluation was March 24, 2026 (~3 months ago). Evaluator agent exists but hasn't been triggered. Root cause likely: no automation triggers evaluator on session completion. Context-learn poller exists for lessons but nothing similar for evaluation.

## Plan
- [ ] Verify evaluator can run successfully (dispatched this heartbeat)
- [ ] Diagnose why evaluator stopped being triggered (missing cron? missing event?)
- [ ] Create evaluation trigger (cron or poller, similar to context-learn-poller)
- [ ] Validate: evaluator produces scores for 5+ sessions
- [ ] Define score thresholds that trigger coaching interventions
- [ ] First coaching intervention based on evaluation data

## References
- .state/evaluations/ — existing evaluation outputs (last: Mar 24)
- agents/evaluator/ — evaluator agent config
- agents/shared/cron.json — cron triggers
