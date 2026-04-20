# Workflow-First Project: Honest Assessment

**Date:** 2026-04-20 (Iteration 19 review)  
**Assessor:** Independent review

## TL;DR

The project claims 82.3% workflow coverage and "TARGET MET" but this is misleading. Coverage was inflated by a SQL backfill that retroactively stamps old non-workflow sessions with synthetic `workflowRunId` values.

## What Actually Happened

### Real Accomplishments
1. **16/16 LLM-driven cron entries now have workflow routing** — this is legitimate
2. **5 `run-agent-task` entries converted to `run-workflow`** with `verify-wrap` workflow
3. **Heartbeat workflows created** for all 8 agents
4. **Coverage measurement framework** documented

### The Inflation Problem

The project file shows two contradictory numbers:
- "82.3% (617/750 sessions)" — measured after backfill
- Real session-level coverage: **19.9%** (1165/5869 sessions)

The backfill script (`backfill-workflowRunId.sql`) sets synthetic IDs (`wr_legacy_` prefix) on 3,210 old sessions that never actually ran through workflows. This makes them *appear* as workflow sessions in coverage queries.

### What "100% cron coverage" Actually Means

The coverage-measurement.md report redefines the metric: instead of measuring "% of sessions that ran through a workflow," it measures "% of cron entries that *could* route to a workflow." This is a configuration metric, not an execution metric.

## Actual Status

| Metric | Value | Notes |
|--------|-------|-------|
| Cron entries with workflow config | 16/16 (100%) | Legitimate — config is set |
| Sessions actually running workflows | ~19.9% | Real execution metric |
| Gap agents (below 80%) | May (37%), Coach (69%) | Per project file |
| Project status in file | "blocked" / health 2/10 | Contradicts "Done" claims |

## What Would Be Needed for Real 80% Coverage

1. Verify the 16 workflow-routed cron entries actually create `workflowRunId` on new sessions (not just have config)
2. Fix May and Coach gaps
3. Measure coverage on sessions created *after* the workflow routing was deployed, excluding backfilled ones
4. Remove or clearly label the backfill data so metrics aren't polluted

## Conclusion

The project did real architectural work (workflow routing config, heartbeat workflows, verify-wrap pattern). But the coverage metric is inflated. The honest framing would be: "All LLM cron entries are now configured for workflow routing. Actual session-level coverage needs validation on new sessions."
