# Project: Workflow Reliability

**Status**: waiting
**Stop Reason**: WAITING

The project is in a 7-day tracking period for v3 guardrails. Day 1 tracking file has been written by the orchestrator (the worker failed to produce it in 2 consecutive attempts despite false 

**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 4

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: 0.85 (7-day avg) → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
V3 guardrails (stub file pre-creation + write-first constraint) deployed in master-worker.ts. Design doc at outputs/workflow-guardrails-v3-design.md. Now entering 7-day tracking period to measure v3 impact. Previous: v2 = 62.5%, v1 = 60%, baseline = 33%.

## Plan
- [x] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [x] Document failure modes (no output, timeout, wrong task)
- [x] Implement guardrails (pre-flight checks, timeout escalation)
- [x] Track success rate for 7 days after guardrails
- [x] Re-plan: review metrics, assess improvement, write next steps
- [x] Implement guardrails v2 (false-claim detection, write-first constraint, iteration cap)
- [x] Track success rate for 7 days with v2 guardrails (result: 62.5% — not enough)
- [x] Design & implement v3 guardrails (structural write-first enforcement)
- [ ] Track success rate for 7 days with v3 guardrails
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
- outputs/workflow-guardrails-v3-design.md — v3 guardrails design (stub pre-creation)
- outputs/v3-guardrails-day1-tracking.md — day 1 v3 tracking (orchestrator-written)
