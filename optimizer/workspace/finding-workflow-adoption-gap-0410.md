# Finding: Workflow Adoption Gap — Why Adoption Is Stuck and Where to Push

**Date**: 2026-04-10T19:30  
**Author**: Optimizer (Mode C: Skill & Technique Scouting)  
**Status**: Complete

## Executive Summary

Workflow adoption isn't "stuck at 7%." The real picture is more nuanced and more interesting:

- **Coach workflows work brilliantly**: growth-cycle (100% done, 26 runs), training-sprint (100%, 4 runs), skill-lifecycle (100%, 12 runs)
- **Bob's D-o-R works well**: Finding from 0410 reports "33 parent sessions, 93 child sessions, 100% success" in 48h. 26% fewer ops vs solo (20 vs 27).
- **Everyone else: zero workflow usage**. Tech-lead (0), may (0), optimizer (0 in current period), scout (0), evaluator (0).
- **implement-and-review is broken**: 6% completion rate (1/16 done). 14/16 escalated.

The "7%" number from the todo likely counted only sessions with `workflowRunId` in the DB, which was broken by the tracking bug (fixed Apr 7, commit `00aed9a`). The DB only has Mar 20-23 data (812 sessions). The real filesystem-based count shows 59 workflow runs producing 152 child sessions out of 812 total = ~19%.

## Current State: Who Uses What

### Active Workflow Users

| Agent | Workflows Used | Evidence | Quality |
|-------|---------------|----------|---------|
| Coach | growth-cycle, training-sprint, skill-lifecycle | 42 filesystem runs, 100% done rate | Excellent |
| Bob | deliver-or-report, parallel-research | Heartbeat-instructed, 33 runs in 48h per Apr 10 finding | Excellent |

### Non-Users (The Gap)

| Agent | Has Workflow Tool? | Has Workflows Defined? | Heartbeat Mentions Workflow? | Total Ops (4 days) |
|-------|-------------------|----------------------|----------------------------|-------------------|
| **Tech-lead** | ✅ | ✅ verified-coder | ❌ ZERO mentions | 1,889 ops |
| **May** | ✅ | ✅ design-then-build, project-monitor, research-pipeline, test-and-fix | ❌ Only "→ Optimizer" routing | 407 ops |
| **Optimizer** | ✅ | ✅ design-review, enhance-cron, safe-edit | ❌ Not in heartbeat | 3,207 ops |
| **Scout** | ❌ | ❌ | ❌ | 216 ops |
| **Coder** | ❌ | ❌ | ❌ | 1,876 ops (but always child) |

## Root Cause Analysis: Why Other Agents Don't Use Workflows

### Cause 1: EXP-028 — LLMs Don't Spontaneously Discover Workflows
This was proven experimentally. Agents will never call `workflow.run()` unless explicitly told to in their heartbeat or cron. Bob uses D-o-R **because his heartbeat says to**. Coach uses growth-cycle **because its heartbeat and cron say to**. Tech-lead's heartbeat says nothing about workflows.

### Cause 2: Heartbeat/Workflow Mismatch
Tech-lead's heartbeat is structured as: observe → think → act (fork or inline). The "ACT" step says `agents.call('fork', ...)` — it tells tech-lead to fork raw sessions, not use workflows. The verified-coder workflow exists but nobody told tech-lead to use it.

Similarly, may's heartbeat routes work to other agents. May's own workflows (design-then-build, etc.) are never mentioned in its heartbeat flow.

### Cause 3: Shared Workflows Don't Match Agent Patterns
The shared workflow library is large (11 active) but poorly matched to actual work patterns:
- `implement-and-review`: 6% completion rate → actively harmful
- `implement-and-verify`: 0 production runs  
- `auto-loop`: 0 production runs (newest, untested)
- `fewshot-inject`: Not a workflow (it's a library function)

Agents that COULD benefit from structured workflows don't have workflows that match what they DO.

### Cause 4: The Workflow/Cost Asymmetry
Workflow adoption would help most where costs are highest:
- **Bob**: $171/4 days ($42.75/day) — **already using D-o-R** ✅
- **Optimizer**: $75/4 days ($18.75/day) — not using any workflow
- **Coach**: $52/4 days ($13/day) — **already using workflows** ✅  
- **Tech-lead**: $49/4 days ($12.25/day) — not using any workflow
- **Coder**: $22/4 days — always a child, workflows won't help here

## Proposal 1: Tech-Lead Heartbeat → Use `implement-and-verify` for Code Tasks

**The opportunity**: Tech-lead avg 27.4 ops/session (Mar 20-23 data), with 28 sessions over 40 ops. Tech-lead does everything inline — zero children, zero forks, zero workflows. When tech-lead needs to implement code changes, it reads files, writes code, runs tests, fixes errors... all in one monolithic session.

**The intervention**: Add a workflow instruction to tech-lead's heartbeat Step 3 (ACT):
```
For code implementation tasks that need testing:
  workflow.run('implement-and-verify', task + '\nverifyCommand: bun test')
```

**Why implement-and-verify, not implement-and-review?**
- `implement-and-review` has 6% completion rate (broken verdict parsing). Don't use it.
- `implement-and-verify` uses shell verification (tsc + vitest), which is mechanical and reliable.
- Tech-lead already has `verified-coder` locally — `implement-and-verify` is the shared equivalent.

**Estimated savings**: 
- If workflow constrains coder sessions to 5-10 ops instead of tech-lead doing 30-40 ops inline
- Conservative: 10 ops saved per code-change session × ~15 code sessions/4 days = 150 ops saved
- At $0.64/session avg: meaningful but modest

**Risk**: Low. implement-and-verify has no production runs, so we'd be first-testing it. But it's mechanically simple (coder → shell verify → retry) with no fragile verdict parsing.

**Validation requirement**: Run this through the gym first. Design 2-3 scenarios where tech-lead must implement+verify code changes. Compare D-o-R workflow path vs raw fork.

## Proposal 2: Wire Bob's D-o-R Into Optimizer Heartbeat

**The opportunity**: Optimizer has the highest avg ops (45.1/session in evaluations) and does research→write deliverable tasks that match D-o-R's pattern perfectly. Today's own session is an example: I'm researching workflow adoption and writing a finding doc.

**The intervention**: Add to optimizer heartbeat:
```
For work sessions that produce a finding/deliverable file:
  workflow.run('deliver-or-report', task)
```

**Why D-o-R?** It's proven (100% success rate for bob), matches optimizer's pattern (research → write document), and adds structural verification that catches FM-3.1 (non-delivery).

**Estimated savings**:
- Optimizer's current pattern: often 40-50 ops doing research + writing inline
- D-o-R splits into plan (Phase 1) + write (Phase 2) + verify (Phase 3), constraining total ops
- Conservative: 10-15 ops saved per session × ~18 optimizer sessions/4 days = 180-270 ops saved

**Risk**: Medium. Optimizer sometimes does complex multi-tool investigation that might not split cleanly into plan/write phases. D-o-R might add overhead for sessions that are mostly tool investigation rather than "write a document."

**Validation**: Track 5-10 optimizer D-o-R sessions and compare vs historical 45-op average. Success = average under 35 ops with same verdict distribution.

## What NOT to Do

1. **Don't push more shared workflows** — The graveyard of 9 archived zero-run workflows proves that building workflows nobody asked for doesn't work. Only build when there's a clear pattern match.

2. **Don't fix implement-and-review** — The verdict-parsing approach is fundamentally fragile. Shell verification (implement-and-verify, verified-coder) is the right pattern for code validation.

3. **Don't create workflows for may or scout** — May's work is routing/dispatching (4.2 avg ops), scout's is scanning (10.3 avg ops). Neither benefits from structured multi-phase workflows. They're already lean.

## Data Sources

- `agents/.state/may.db` sessions table: 812 sessions, Mar 20-23 (4 days)
- `agents/.state/may.db` evaluations table: 733 evaluated sessions, same period
- `agents/.state/workflows/`: 59 workflow run JSON files, same period
- Agent heartbeat files: `agents/*/heartbeat.md`
- Agent workflow directories: `agents/*/workflows/`
- Prior findings: `finding-workflow-audit-0404.md`, `finding-workflow-health-0410.md`, `workflow-adoption-investigation.md`
