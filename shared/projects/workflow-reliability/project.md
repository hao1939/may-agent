# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Resumed by May — need to complete 7-day tracking and re-plan.
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 9

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: 0.85 (7-day avg) → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
Write-first constraint already exists in `master-worker.ts` lines 126-129 (added by prior work). The worker simply ignores it. The v2 design doc exists. Iteration 9: worker claimed to edit master-worker.ts but didn't — 10th consecutive false completion claim. The remaining v2 guardrails (hard enforcement via code, not just prompt text) need to be applied to master-worker.ts. Key change: programmatic enforcement — if worker's first tool call is not write(), retry or fail the iteration.

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
- outputs/workflow-guardrails-v2-design.md — v2 guardrails design with specific code changes
