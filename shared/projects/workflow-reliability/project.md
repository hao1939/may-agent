# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Resumed by May — need to complete 7-day tracking and re-plan.
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 11

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: 0.85 (7-day avg) → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
All 5 original milestones complete. Artifacts exist in outputs/. Worker has failed 11 consecutive iterations with false completion claims — cannot be trusted to make code changes. Next: apply v2 guardrail (automatic retry on zero-output) to master-worker.ts lines 320-327. The change: when changedFiles.length === 0 and consecutive < MAX_ZERO_OUTPUT, re-prompt the worker with escalated "WRITE NOW" message instead of proceeding to review. This is a ~15-line code change.

## Plan
- [x] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [x] Document failure modes (no output, timeout, wrong task)
- [x] Implement guardrails (pre-flight checks, timeout escalation)
- [x] Track success rate for 7 days after guardrails
- [x] Re-plan: review metrics, assess improvement, write next steps
- [x] Implement guardrails v2 (false-claim detection, write-first constraint, iteration cap)
- [ ] Track success rate for 7 days with v2 guardrails
- [ ] Achieve sustained 90%+ iteration success rate

## References

**Resources:**
- agents/shared/workflows/master-worker.ts — the workflow being measured
- handler.success-rate metric — existing handler health metric

**Artifacts:**
- outputs/workflow-reliability-baseline.md — baseline measurement (33% success rate)
- outputs/workflow-guardrails-design.md — guardrail design doc
- outputs/sustained-rate-tracking.md — 7-day tracking (filled, overall 60%)
- outputs/day7-rate-tracking.md — day 7 tracking + false completion failure mode analysis
- outputs/replan.md — re-plan with guardrails v2 proposal
- outputs/workflow-guardrails-v2-design.md — v2 guardrails design with specific code changes
