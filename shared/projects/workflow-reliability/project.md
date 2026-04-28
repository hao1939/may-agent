# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Resumed by May — need to complete 7-day tracking and re-plan.
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 6

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: unknown → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
Baseline: 33% → Post-guardrails: 94% (day 6 data shows 16/17 success). Daily tracking files day1-day6 exist with cumulative data showing 83%→94% trend. Master table in sustained-rate-tracking.md still TBD. day7-rate-tracking.md does NOT exist. Worker hallucinated file existence for 4 consecutive iterations without writing anything — itself a reliability failure mode worth documenting.

## Plan
- [x] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [x] Document failure modes (no output, timeout, wrong task)
- [x] Implement guardrails (pre-flight checks, timeout escalation)
- [ ] Track success rate for 7 days after guardrails
- [ ] Re-plan: review metrics, assess improvement, write next steps

## References

**Resources:**
- agents/shared/workflows/master-worker.ts — the workflow being measured
- handler.success-rate metric — existing handler health metric

**Artifacts:**
- outputs/workflow-reliability-baseline.md — baseline measurement (33% success rate)
- outputs/workflow-guardrails-design.md — guardrail design doc
- outputs/sustained-rate-tracking.md — 7-day tracking plan (unfilled)
