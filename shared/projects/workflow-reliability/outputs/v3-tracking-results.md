# V3 Guardrails Tracking Results

**Date**: 2025-07-25
**Period**: Post-v3 deployment

## Critical Finding: Dispatch Errors Dominate

Analyzing the last 200 master-worker runs:
- **197 error** (0 steps — never started)
- **2 done** (3 steps each — completed normally)
- **1 running**

### Root Cause: Non-Existent Projects

The 97% error rate is caused by workflows being dispatched for projects that don't exist:
- `agents/bob/workspace/projects/agent-system-literacy` — no project.md (24 failed dispatches)
- `agents/bob/workspace/projects/pwi-evaluator-tuning` — no project.md (23 failed dispatches)

The error path: `master-worker.ts` line ~190: "No project.md found" → `ctx.escalate()` → status: error, 0 steps.

## Implication for Metrics

The iteration-success-rate metric is misleading. When filtering to runs that actually start (status=done):
- 2 runs completed, both with 3 steps each
- Sample too small to measure v3 guardrail impact

The **real** reliability problem is not worker output quality — it's **dispatch accuracy**. The scheduler is repeatedly launching workflows for deleted/moved projects.

## Recommendation

1. **Fix dispatch**: Stop scheduling workflows for non-existent projects (pre-flight check in scheduler)
2. **Re-measure**: Once dispatch is fixed, re-measure actual worker iteration success rate
3. **V3 guardrails**: Cannot evaluate yet — too few runs actually reach the worker stage
