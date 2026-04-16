# Context Management — Orchestrator Longevity

**Owner:** tech-lead
**Goal:** persistent-task orchestrator runs 50+ iterations without context overflow
**Status:** active
**Created:** 2026-04-16
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md)

## Why This Matters
If the orchestrator runs indefinitely, no auto-resume needed. No caps. No turn budgets. Tasks just run to completion. This unblocks everything.

## Key Metric
`context.orchestrator-max-iterations` — current: unknown, target: 50+

## The Problem
Each iteration adds tool call results to session context: read project → call worker → record result → call reviewer → loop. After N iterations, context overflows.

## The Fix
Keep orchestrator lean:
- Don't accumulate full worker results in context — summarize and write to project file
- Project file is the memory, not the context window
- Prune old iterations in project file (collapse to one-liners)

## Milestones
- [ ] Measure current max iterations before overflow
- [ ] Implement context-lean orchestration (summarize worker output)
- [ ] Prune old iterations in project file
- [ ] Test: 50+ iterations without overflow
- [ ] Document the pattern for other workflows

## Progress Log

### 2026-04-16 — Initial work
- Added `pruneOldIterations()` to persistent-task.ts — collapses old iterations to one-line summaries, keeps last 5 full
- Verified 60% file size reduction at 25 iterations
- Compiles clean
