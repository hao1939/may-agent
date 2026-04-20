# Workflow-First Coverage: Status Report (Iteration 4 Review)

**Date**: 2026-04-20  
**Project**: Workflow-First Culture  
**Goal**: Increase workflow coverage from 31% to 80%

## Current Reality

| Metric | Value | Source |
|--------|-------|--------|
| Session-level coverage (raw) | **19.9%** (1165/5869) | sessions.db query |
| Claimed coverage (post-backfill) | 82.3% (617/750) | SQL backfill applied retroactively |
| LLM-driven cron entry coverage | 62.5% → potentially 81.3% | cron.json audit |

## What Was Actually Done (Iters 1–16)

1. **Workflow audit** — categorized existing workflows (keep/archive/investigate) → `workflow-audit-2026-04-19.md`
2. **Freestyle pattern identification** — top 3 patterns identified → `freestyle-patterns-2026-04-19.md`
3. **Heartbeat workflow created** — `agents/shared/workflows/agent-heartbeat.ts` + per-agent variants
4. **Cron configs updated** — heartbeat workflow wired into agent cron.json files
5. **Coverage measurement** — `coverage-measurement.md` produced with honest numbers

## Gap Analysis

The **80% target is NOT met** on real session-level data (19.9%).

The 82.3% figure was achieved via a SQL backfill (`backfill-workflowRunId.sql`) that retroactively tagged sessions — this inflates the metric without changing actual agent behavior.

### Why the gap exists

- **workflowRunId not set at dispatch time**: Many cron-dispatched sessions never get `workflowRunId` populated because the dispatch mechanism doesn't pass it through.
- **Non-heartbeat sessions uncovered**: Chat sessions, handler-load-failure sessions, and ad-hoc work sessions have no workflow.
- **Agent gaps**: May (37%) and Coach (69%) remain below 80%.

## What Would Actually Close the Gap

1. **Fix dispatch plumbing**: Ensure `workflowRunId` is set when cron.json dispatches to a workflow (not backfilled after the fact)
2. **Route May and Coach**: Create/wire workflows for their remaining freestyle patterns
3. **Define scope clearly**: Decide whether "80% coverage" means all sessions or only LLM-driven cron sessions — the answer changes the denominator dramatically

## Conclusion

The project made real structural progress (audit, patterns, heartbeat workflow, cron wiring) but the coverage target requires infrastructure fixes to the dispatch pipeline, not just workflow file creation.
