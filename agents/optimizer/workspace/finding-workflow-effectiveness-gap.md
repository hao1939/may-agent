# Finding: Project Workflow Errors Dragging Workflow-Effectiveness Below Target

**Date**: 2026-03-17  
**Metric**: optimizer.workflow-effectiveness = 84.8% (target: 90%)  
**Severity**: Medium — metric breach, systemic waste

## Data

Of the last 100 workflow runs:
- **58 done** (58%)
- **37 error** (37%)  
- **5 running** (5%)

The 37% error rate is the sole cause of workflow-effectiveness being below target.

### Error Breakdown

**Instant crashes (26/37)** — 0 steps, 2-4ms execution:
- ALL are `project` workflow for `agents/may/workspace/projects/metrics-dashboard`
- ALL have `agent: Hao` — Hao is a human, not an agent
- The project status is "done", so the workflow should return immediately via `ctx.done()`
- Instead it crashes, likely because the `runAgent` context method fails when the agent doesn't exist
- Root cause: `diagnoseProject()` returns "launch-workflow" for a done project owned by a human

**Late failures (11/37)** — multiple successful steps but final status "error":
- Projects: `prove-the-loop`, `breadcrumb-gap`, `convention-compliance` (coach), `agent-cli-research` (bob)
- These complete 2-8 agent sessions successfully, then the workflow throws
- Likely: unhandled exception in the iteration loop (timeout, max iterations, or parsing error)

## Impact

- 37 wasted workflow run records per ~100 runs
- Workflow-effectiveness metric suppressed by ~5.2 percentage points
- The Hao crashes recur every cron tick (~26 times in recent window), pure waste

## Recommended Fixes

1. **`diagnoseProject()` should skip projects owned by non-agent names** (or at minimum, skip "done" projects owned by humans). This eliminates 26/37 errors.

2. **The project workflow `execute()` should catch and gracefully handle errors** in its iteration loop instead of letting them propagate as unhandled exceptions. This would convert 11 "error" results to "done" with appropriate summaries.

3. **Quick fix**: Set `metrics-dashboard` project status to something `diagnoseProject` will skip (it's already "done" — the bug is that done projects are still being launched).
