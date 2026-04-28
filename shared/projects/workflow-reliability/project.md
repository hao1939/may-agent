# Project: Workflow Reliability

**Status**: waiting
**Stop Reason**: WAITING

The 7-day tracking table can't be filled retroactively — it needs to be populated day-by-day as new iterations occur. The qualitative evidence already shows improvement (33% → 100% for iterat
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 2

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: unknown → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
Baseline: 33% → Post-guardrails: 100% (iterations 6-9). Tracking table still unfilled with daily data. Need to populate it as days pass. Iteration 2 complete.

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
