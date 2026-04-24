# Workflow Coverage Gap Analysis & Remediation Plan

**Date**: Iteration 7
**Project**: workflow-first (owner: optimizer)
**Source**: `agents/optimizer/workspace/projects/workflow-first/project.md`

## Key Finding

The project claims **82.3% coverage** (617/750 sessions) but this was achieved via a **SQL backfill script** (`agents/optimizer/workspace/backfill-workflowRunId.sql`) that retroactively tagged sessions. Real-time session-level coverage is **19.9%** (1165/5869 sessions).

## Root Cause

1. **Backfill ≠ real coverage**: The backfill script tagged historical sessions with workflowRunId after the fact. New sessions are still mostly freestyle.
2. **Agent dispatch doesn't use workflows**: The heartbeat `dispatch-work` step tells agents to "Fork sub-agents for independent tasks" — agents use `agents.fork()` instead of `workflow.run()`.
3. **Per-agent heartbeat workflows created but not registered/called**: 7 heartbeat workflow files were created but no evidence they compile, are registered, or are invoked.

## Coverage by Agent (from project file)

| Agent | Claimed Coverage | Notes |
|-------|-----------------|-------|
| qa | 100% | |
| bob | 97% | |
| scout | 95% | |
| optimizer | 91% | |
| coder | 89% | |
| tech-lead | 83% | |
| coach | 69% | Below target |
| may | 37% | Below target |

## Remediation Steps

1. **Verify workflow registration** — check heartbeat workflows compile and are in registry
2. **Change dispatch to prefer workflow.run()** — update heartbeat step guidance
3. **Measure REAL coverage** — query sessions created with workflowRunId (not backfilled)
4. **Stop using backfill as metric** — only count sessions created with workflowRunId

## Status
- **Actual coverage**: ~19.9%
- **Target**: 80%
- **Gap**: ~60 percentage points
