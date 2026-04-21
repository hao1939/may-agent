# Workflow Coverage Status Report
**Date**: 2026-04-22
**Measured by**: optimizer (real DB query, no backfill)

## Executive Summary

**Workflow coverage is 93.8%** for core agents (25,741/27,455 sessions in last 7 days with real `workflowRunId`). The 80% target is **exceeded by 13.8 percentage points**.

This is real, measured coverage — excluding `wr_legacy_*` backfill IDs, counting only genuine workflow-routed sessions.

## Coverage by Agent (Core, Last 7 Days)

| Agent | Sessions w/ WF | Total | Coverage |
|-------|---------------|-------|----------|
| amy-kimi | 990 | 1,002 | 99% |
| amy | 991 | 1,021 | 97% |
| may | 4,895 | 5,082 | 96% |
| evaluator | 3,911 | 4,093 | 96% |
| qa | 1,176 | 1,235 | 95% |
| coach | 3,426 | 3,649 | 94% |
| tech-lead | 2,891 | 3,092 | 93% |
| optimizer | 2,461 | 2,674 | 92% |
| scout | 1,415 | 1,539 | 92% |
| bob | 3,249 | 3,610 | 90% |
| coder | 334 | 443 | 75% |
| master | 2 | 15 | 13% |

## Gap Analysis

### What's NOT covered (6.2% = ~1,714 sessions/week)

The non-workflow sessions fall into these categories:

1. **`agents.fork` dispatched tasks** — Human requests triaged by May and forked to agents. These bypass workflows because `agents.fork` doesn't set `workflowRunId`.
   - Fix: Route through a dispatch workflow, or have May use `workflow.run` instead of `agents.fork`.

2. **Heartbeat sessions with `source=null`** — Some heartbeat sessions appear without workflowRunId despite being workflow-labeled in their task. Likely a race condition or sync delay.

3. **Evaluator digest sessions** — Triggered by zombie cleanup or other JS handlers, not workflow-routed.

4. **Coder gap (75%)** — Coder has more ad-hoc forked sessions proportionally.

5. **Master sessions (13%)** — Master is rarely used, low priority.

### Cron Entry Coverage

15/53 cron entries (28.3%) use `run-workflow` handler. However, the 38 non-workflow entries are mostly **pure JS handlers** (zombie cleanup, session sync, metrics, auto-merge) that don't spawn LLM sessions. The meaningful metric is session-level coverage, not cron-entry coverage.

## Recommendations to Reach 95%+

1. **Route `agents.fork` through workflows** — Would capture the ~5% of sessions dispatched by May/agents directly. Requires runtime change.
2. **Propagate workflowRunId from parent** — When a workflow step forks a child, the child should inherit the parent's workflowRunId. The session-sync handler already does this partially.
3. **Fix coder coverage** — Investigate why coder has 75%. Likely needs a work-session workflow for ad-hoc tasks.

## New Metrics (as requested)

### Workflow Coverage (already met)
- **Definition**: % of sessions with non-null, non-legacy workflowRunId in last 7 days
- **Current**: 93.8% (core agents)
- **Target**: 80% ✅

### Workflow Effectiveness (proposed)
- **Definition**: Compare quality/efficiency scores of workflow vs non-workflow sessions
- **Measurement**: `AVG(e.quality) WHERE s.workflowRunId IS NOT NULL` vs `IS NULL`
- **Purpose**: Validate that workflows actually improve outcomes, not just structure

## Conclusion

The 80% workflow coverage goal has been **achieved and exceeded**. The project file should be updated to reflect this verified state. Remaining work is incremental optimization toward 95%+ by routing `agents.fork` dispatches through workflows.
