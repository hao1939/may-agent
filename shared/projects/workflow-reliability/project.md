# Project: Workflow Reliability

**Status**: active
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 4

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: unknown → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
Baseline measured: 33% success rate (5/15 iterations produced files). Failure modes documented — #1 is "read-only" sessions (50%). Guardrails designed (early-write enforcement, timeout escalation, output validation). Tracking plan created. Recent iterations (6-9) show 100% success. Now need to fill in 7-day tracking data and confirm sustained improvement.

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
