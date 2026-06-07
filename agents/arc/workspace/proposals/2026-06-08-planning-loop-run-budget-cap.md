# Proposal: Planning Loop Run Budget Cap

**Priority**: P1
**Proposed**: 2026-06-08
**Author**: arc (heartbeat)
**Connects**: KE-1654 (planning loop meta-retry gap), KE-1580 (horizontal retry churn), KE-1572 (interrupt storm phase transition)

## Problem

The project execution engine enforces per-task retry limits (`MAX_INTERRUPTED_CONTROL_REWORK_ATTEMPTS = 3`) but places no cap on the planning loop itself. When a rework-review task exhausts its 3 interrupted attempts, `recoverStalledPlanningLoopRework()` supersedes it and calls `createPlanningLoopRun()` to start a fresh planning run — with a fresh attempt counter.

This creates an unbounded meta-retry loop:

```
Planning run N → proposes tasks → tasks interrupted → rework created
→ rework interrupted 3x → superseded → fresh planning run N+1
→ proposes same/similar tasks → cycle repeats
```

Current state of aks-rp-e2e:
- 176 planning loop run tasks (78 superseded)
- 739 total tasks (288 rework/review, 194 superseded)
- 78% interrupt rate in last 6h (64/82 sessions)
- ~4,700 ops/day burned on interrupted sessions

The design doc (`project-execution-engine.md` lines 1205-1209) specifies "Maximum horizontal retries per task: 3" — correctly implemented for leaf tasks — but says nothing about a budget for the loop that creates tasks.

## Proposed Fix

Add a `MAX_CONSECUTIVE_FAILED_PLANNING_RUNS` constant (suggested value: 5) to the execution engine runtime. The guard logic:

1. In `recoverStalledPlanningLoopRework()`, before creating a fresh planning run, count the number of **consecutive** planning runs whose terminal status is `superseded` (i.e., no run between the current one and the last `accepted`/`decomposed` run was successful).

2. If the consecutive-failed count exceeds `MAX_CONSECUTIVE_FAILED_PLANNING_RUNS`:
   - Mark the planning loop itself as `blocked` with a diagnostic blocker message: `"Planning loop exhausted after N consecutive failed runs — requires human review or scope reduction."`
   - Do NOT create a new planning run.
   - Emit a `project.planning-loop.exhausted` event for visibility.

3. The budget resets any time a planning run reaches `accepted` or `decomposed` status (evidence of genuine progress).

### Implementation Location

**Runtime**: `projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts`
- Add constant at line ~125: `const MAX_CONSECUTIVE_FAILED_PLANNING_RUNS = 5;`
- Add helper: `function consecutiveFailedPlanningRuns(tree: TaskTree): number` — walks `planningLoopRuns()` in reverse ordinal order counting `superseded` runs until hitting an `accepted`/`decomposed` one.
- Gate in `recoverStalledPlanningLoopRework()` (line ~1490): before `createPlanningLoopRun()`, check the budget. If exceeded, block the loop instead.

**Design doc**: `shared/may-agent-docs/2a-design/project-execution-engine.md`
- Add a meta-level constraint after the existing horizontal retry limit (line ~1209): "Maximum consecutive failed planning loop runs: 5. When N consecutive planning runs end in `superseded` without any reaching `accepted` or `decomposed`, mark the planning loop as `blocked` rather than creating run N+1."

## Why P1 (not P0)

The project is already in `waiting` status in the DB and the active task (`spec-index-status-backfill`) is a domain leaf, not a planning loop run. The interrupt storm rate has been stable for 2+ days rather than accelerating. Immediate risk is resource waste, not data loss. But it should be implemented before the project resumes active push, since resumption would re-trigger the loop.

## Expected Impact

- Eliminates unbounded planning loop cycling (the immediate source of 78% interrupt rate)
- Reduces aks-explorer session volume by ~55% (the interrupted fraction)
- Unblocks the `evaluator.substantive-low-quality-rate-24h` metric (0.37, red) which is dominated by aks-explorer interrupted session evaluations
- Provides a clear diagnostic signal (blocked + event) instead of silent cycling

## Validation

After implementation:
1. aks-explorer interrupt rate should drop below 20% within 6h
2. Planning loop run count should plateau (no new superseded runs)
3. A `project.planning-loop.exhausted` event should be visible in the event bus
4. The `session.error-rate-6h` metric (currently 0.25) should improve
