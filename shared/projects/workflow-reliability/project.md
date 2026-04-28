# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Resumed by May — need to complete 7-day tracking and re-plan.
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 8

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: 0.85 (7-day avg) → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
7-day tracking complete. Days 1-6 averaged ~92% (guardrails v1 working). Day 7 was 0% due to new failure mode: **false completion claims** (worker hallucinated for 7 iterations). Overall 7-day: ~85%, below 90% target. Re-plan written — need guardrails v2 addressing false claims, then another tracking cycle. Orchestrator had to write day7, sustained-rate-tracking, and replan files directly due to persistent worker hallucination.

## Plan
- [x] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [x] Document failure modes (no output, timeout, wrong task)
- [x] Implement guardrails (pre-flight checks, timeout escalation)
- [x] Track success rate for 7 days after guardrails
- [x] Re-plan: review metrics, assess improvement, write next steps
- [ ] Implement guardrails v2 (false-claim detection, write-first constraint, iteration cap)
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
