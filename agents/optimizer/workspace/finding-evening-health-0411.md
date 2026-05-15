# Finding: Bob Heartbeat Bloat Pattern

**Date**: 2026-04-11
**Analyst**: Optimizer
**Severity**: Medium — 30% of Bob's HB ops wasted
**Status**: Root causes identified, interventions recommended

## Summary

Bob's heartbeat sessions periodically bloat to 30-55+ ops (vs 2-5 op lean baseline) while producing **zero files modified and zero children forked**. The original "evening health" signal (49-op and 55-op sessions at 20:xx on Apr 10-11) is real but it's a *symptom* of a general pattern, not a time-specific phenomenon.

## The Numbers (Apr 10-11)

| Metric | Value |
|--------|-------|
| Total Bob HBs | 92 |
| Total ops | 934 |
| Bloated (>20 ops) | 8 (8.7%) |
| Excess ops (vs 5-op baseline) | 279 (29.9% of total) |
| Bloated with 0 children (pure waste) | 3 of 8 |
| Worst sessions | 55 ops (0 children, 0 files), 49 ops (0 children, 0 files), 42 ops (3 children) |

### Hour-of-day distribution (Apr 10-11)

Bloated sessions occur at hours: 2, 4, 5, 10, 15, 19, 20. **Not evening-specific.** Hour 20 has the highest average (29.3 ops) only because both coincidentally-bad sessions fell there.

### Pre vs Post reforms comparison

| Period | Avg ops | Bloated (>20) % | Lean (≤5) % |
|--------|---------|------------------|-------------|
| Apr 9 (pre-reform) | 24.2 | 32% (15/47) | 0% |
| Apr 10-11 (post-reform) | 10.2 | 8.7% (8/92) | 43% |

Reforms clearly helped — avg ops dropped 58%, lean sessions went 0→43%, bloated sessions dropped from 32% to 9%. But the remaining bloated sessions are more egregious (pure waste sessions with 0 output).

## Root Causes

### RC-1: 164KB todo.md (999 lines) — "Infinite Reading Loop"

Bob's heartbeat.md Step 1 says: "Read `agents/bob/workspace/todo.md` for ongoing priorities." This file is 999 lines / 164KB of detailed session notes, experiment results, and history. When Bob reads this, he:

1. Burns 2-3 ops just reading (pagination)
2. Sees dozens of completed items and experiments
3. Decides to "verify" or "check status" of things already done
4. Reads more files to confirm status
5. Finds nothing new but keeps reading/verifying
6. Eventually produces no output

**Evidence**: The 55-op session (Apr 11 20:53) and 49-op session (Apr 10 20:23) both had: 0 children, 0 files modified, outcomes saying "clean" or "no productive work." But they burned 49-55 ops doing **verification reads** of things already completed.

### RC-2: No hard op budget in heartbeat.md

The heartbeat says "budget: 1-2 ops max" for Step 1 (observe), but there's no enforcement and no total budget. When Bob finds nothing actionable but has read a massive todo list, he often continues scanning rather than exiting.

### RC-3: Synchronous workflow.run() for ALL dispatched work

When Bob DOES dispatch work, he uses `workflow.run('deliver-or-report', task)` which is **synchronous** — Bob waits for it to complete. The 72-op session (Apr 10 15:23, 2.2M input tokens) spawned 1 child with only 5 ops but the parent burned 67 ops waiting around it.

### RC-4: Empty inbox → verification spiral

The bloated 0-children sessions share a common pattern: Bob wakes up, finds no pending requests, no new drops, no new experiments — and instead of exiting in 3-5 ops, enters a "verification spiral" where he reads files to confirm nothing changed. The 123-op session (Apr 9 22:23, 137 turns, 40 minutes, 0 children, 0 files modified) is the extreme example.

## Specific Evening Context (Apr 10-11, 20:xx)

The two evening bloated sessions aren't caused by anything evening-specific. They're caused by Bob waking up during a **quiescent period** (no active experiments, no new drops, no pending requests) with the massive todo.md providing endless "things to check." The lean sessions immediately before them (19:53, 3 ops) and after them (21:23, 5 ops) correctly identified "nothing to do" and exited.

**The difference**: Stochastic — same context, same instructions, but Bob sometimes goes down the rabbit hole of "let me verify everything is still fine" instead of quickly concluding "nothing to do."

## Recommended Interventions

### I-1: Split todo.md into active vs archive (HIGH IMPACT)

Move all completed items (marked `[x]`) and session notes into `todo-archive.md`. Keep `todo.md` under 50 lines with ONLY:
- Currently active/in-progress items
- Blocked items
- Next-up items

**Expected impact**: Reduces reading time from 3-4 ops to 1 op, eliminates the "verification spiral" trigger of seeing completed experiments to check on.

### I-2: Add explicit heartbeat op budget (MEDIUM IMPACT)

Add to heartbeat.md: "**TOTAL HEARTBEAT BUDGET: 8 ops max.** If you haven't dispatched or produced output by op 8, call finish() immediately with what you observed."

### I-3: Add "nothing to do" fast-exit pattern (MEDIUM IMPACT)

Add to heartbeat.md Step 2: "**If all of these are true, exit immediately (2-3 ops total):**
- No pending requests (check injected tasks section)
- No new experiment results (ls output shows nothing new)
- No new deep-dive drops
- Todo.md shows no in-progress items that need attention
→ Call finish('Nothing actionable. System is quiescent.') without reading further."

### I-4: Use agents.fork() instead of workflow.run() for dispatch (LOW IMPACT, ARCHITECTURAL)

When Bob dispatches work, use non-blocking `agents.fork()` and move on. This prevents the parent session from burning ops waiting for the child. The deliver-or-report workflow verification can still happen in the forked session.

## Files Examined

- `agents/bob/heartbeat.md` — dispatch instructions
- `agents/bob/workspace/todo.md` — 999-line / 164KB todo file
- `.state/may.db` — sessions, session_digests, evaluations, requests tables
- Sessions analyzed: 92 Bob HBs from Apr 10-11, with deep analysis of 55-op, 49-op, 72-op, and 123-op bloated sessions
