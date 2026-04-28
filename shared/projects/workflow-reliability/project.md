# Project: Workflow Reliability

**Status**: active
**Owner**: coach
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 0

## Goal
Reduce workflow failures. Target: 90%+ of worker iterations produce at least one deliverable file.

## Metrics
- workflow.iteration-success-rate: unknown → target 0.90 (% of iterations producing a file)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
New project. No baseline measured yet.

## Plan
- [ ] Measure current worker success rate over last 14 days, write outputs/baseline.md
- [ ] Document failure modes (no output, timeout, wrong task)
- [ ] Implement guardrails (pre-flight checks, timeout escalation)
- [ ] Track success rate for 7 days after guardrails
- [ ] Re-plan: review metrics, assess improvement, write next steps

## References

**Resources:**
- agents/shared/workflows/master-worker.ts — the workflow being measured
- handler.success-rate metric — existing handler health metric

**Artifacts:**
- (none yet)
