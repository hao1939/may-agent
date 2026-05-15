# Finding: Training-Sprint Workflow Reliability (60% Failure Rate)

**Date**: 2026-04-04
**Severity**: P1 (Coach's primary growth mechanism is broken)
**Category**: Workflow reliability

## Summary

The `training-sprint` workflow has a 60% interrupt rate. The last 6 runs:
- 2 interrupted at Plan step (Step 1) — never reached Step 2
- 1 interrupted at Execute step (Step 2) — had 107 ops across 2 sessions
- 1 done with 2 sessions (28 ops)
- 2 done with different workflow paths

**Root cause**: All interrupts are `"Request was aborted."` — process restarts kill workflow sessions mid-flight.

## Architecture Problem

The training-sprint runs through a **triple indirection** that amplifies failure risk:

```
Cron → run-agent-task (Coach LLM session #1, ~5-10 ops overhead)
  → workflow.run("training-sprint")
    → Step 1: Coach LLM session #2 (plan, 30-67 ops)
    → Step 2: Coach LLM session #3 (fork+patch, 25-40 ops)
    → Step 3: JS gym tests (no LLM)
    → Step 4: JS promote/discard (no LLM)
```

Any process restart during Steps 1-2 kills the entire chain. With 30-minute cron intervals and sessions taking 10-50 minutes, there's a high probability of overlapping with a restart.

## Specific Issues

### 1. Planning step is overloaded (Step 1)
The planning prompt asks Coach to:
- Read todo.md
- Read ERROR_LOG.jsonl for all agents
- Read method-catalog.md
- Read experiments.jsonl
- Run baseline gym for EACH candidate
- Select 3-5 experiments
- Write sprint-plan.md

This routinely exceeds the 30-call budget (actual: 39-97 ops).

### 2. No checkpoint/resume
If the workflow is interrupted mid-plan, ALL work is lost. No intermediate state is saved.

### 3. Unnecessary wrapper session
`handler: "run-agent-task"` creates a Coach LLM session that reads heartbeat, then calls `workflow.run()`. This wastes 5-10 ops on overhead.

## Recommendations (ordered by effort/impact)

### Quick Fix: Convert cron to direct workflow dispatch
Change the cron entry from `handler: "run-agent-task"` to a JS handler that calls the workflow directly, saving the wrapper LLM session.

### Medium Fix: Split planning into JS + LLM
Move the mechanical parts of planning to JS:
- Read ERROR_LOG.jsonl files (JS)
- Read experiments.jsonl (JS)
- Run baseline gym tests (JS)
- Pass only the filtered candidates to Coach LLM for selection

This cuts Step 1 from 30-67 ops to ~10 ops.

### Root Cause Fix: Fix gracefulRestart() session preservation
(Already escalated: see `finding-interrupted-waste-0404.md`)
Skip session cancellation during hot-reload restarts so workflows can resume.

## Data

| Workflow Run | Sessions | Total Ops | Status | Duration |
|---|---|---|---|---|
| wr_1775034577833 | 1 | 10 | interrupted | 6.6min |
| wr_1774947983323 | 1 | 39 | interrupted | 3.1min |
| wr_1774928628842 | 2 | 28 | done | - |
| wr_1774861578760 | 2 | 107 | interrupted | 49min |
| wr_1774860202689 | 2 | 32 | done | - |
| wr_1774856431747 | 1 | 23 | interrupted | 7.6min |
