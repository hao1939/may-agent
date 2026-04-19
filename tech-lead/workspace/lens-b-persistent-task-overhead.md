# Lens B: persistent-task Workflow Overhead Analysis

**Date**: 2026-04-19
**Target**: `agents/shared/workflows/persistent-task.ts` — end-to-end flow complexity

## Summary

The persistent-task workflow has a **50% agent-call overhead per iteration** by design: each iteration spawns both a worker agent and an owner-review agent. The file bookkeeping (read/write/parse/prune) is pure JS with zero LLM cost, so the overhead is almost entirely in the review step. For a 10-iteration run, that's 10 worker calls + 10 review calls = 20 agent spawns, half of which are pure overhead.

## Evidence: Per-Iteration Flow

Each loop iteration (`persistent-task.ts:303–380`) does:

1. **Re-read project file + check status** — pure JS (`persistent-task.ts:305–312`)
2. **Worker phase** — `ctx.runAgent(worker, workerPrompt)` (`persistent-task.ts:319`) — **actual work**
3. **Persist worker output** — `appendIterationWorker()` + `updateField()` + `pruneOldIterations()` + `writeProjectFile()` — pure JS (`persistent-task.ts:337–350`)
4. **Owner review phase** — `ctx.runAgent(owner, reviewPrompt)` (`persistent-task.ts:367`) — **overhead**
5. **Persist assessment** — `appendAssessment()` + `updateField()` — pure JS (`persistent-task.ts:383–385`)

**Agent calls per iteration**: 2 (1 worker + 1 review)
**Overhead ratio**: 50% of agent spawns are review overhead

## Additional Overhead Sources

- **Prompt construction**: `buildWorkerPrompt()` (`persistent-task.ts:176–209`) extracts last 3 iterations of context. `buildReviewPrompt()` (`persistent-task.ts:219–270`) includes milestones, review rubric (loads from disk at `persistent-task.ts:247`), and recent progress. These prompts grow with iteration history.
- **Pruning**: `pruneOldIterations()` (`persistent-task.ts:257`, `KEEP_RECENT=5` at `persistent-task.ts:254`) collapses iterations older than 5 to one-liners. This bounds file size but adds processing each iteration.
- **Crash recovery**: `pendingReview` check (`persistent-task.ts:297–300`) re-reviews the last iteration if worker completed but review didn't. Adds 1 extra review call in crash scenarios.
- **Lock check**: Stale lock heuristic (`persistent-task.ts:282–291`) reads `Updated` timestamp; escalates if <30min old. Can block legitimate re-runs.

## The 154-op Session is NOT a Workflow Run

The highest-op coach session (`s_1776551125350_659`, 154 ops) is a **[WORK SESSION]** analyzing persistent-task failures and running gym trials — not a persistent-task workflow execution. Its high op count comes from task scope (reading transcripts, designing interventions, running gym batches), not workflow overhead.

## Severity

**Low**. The 50% review overhead is intentional and valuable — the owner review provides steering, early termination, and quality control. Without it, workers would iterate blindly. The `reviewEvery` parameter (`persistent-task.ts:80`, default 1) already allows reducing review frequency (e.g., `reviewEvery: 3` = review every 3rd iteration = 33% → 14% overhead ratio).

## Recommended Action

No action needed. The overhead is by-design and tunable via `reviewEvery`. If specific projects are over-reviewed, callers can pass `reviewEvery: 2` or `reviewEvery: 3` to reduce overhead.
