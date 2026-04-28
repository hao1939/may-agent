# Project: Workflow Reliability

**Status**: active
**Stop Reason**: Waiting — v2 guardrails deployed, need 7 days elapsed for tracking.
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
Guardrails v2 implemented in master-worker.ts (2025-07-01):
1. Write-first constraint in worker prompt ✅
2. Orchestrator verification rule — trust output verification, not worker claims ✅
3. Auto-termination after 6 consecutive zero-output iterations ✅
4. Escalation messaging at 3 consecutive failures ✅
Next: track success rate for 7 days with v2 guardrails active.

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
