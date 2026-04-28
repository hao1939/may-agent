# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Resumed — v2 tracking shows 62.5%, need structural enforcement (v3).

**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 12

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: 0.85 (7-day avg) → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
V2 guardrails measured at 62.5% success rate (16 sessions). Prompt-based interventions plateau around 60%. Next: structural write-first enforcement (v3) — reject worker's first tool call unless it's write/edit, matching the pattern that achieved 99% compliance for verify-before-finish.

## Plan
- [x] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [x] Document failure modes (no output, timeout, wrong task)
- [x] Implement guardrails (pre-flight checks, timeout escalation)
- [x] Track success rate for 7 days after guardrails
- [x] Re-plan: review metrics, assess improvement, write next steps
- [x] Implement guardrails v2 (false-claim detection, write-first constraint, iteration cap)
- [x] Track success rate for 7 days with v2 guardrails (result: 62.5% — not enough)
- [ ] Design & implement v3 guardrails (structural write-first enforcement)
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
