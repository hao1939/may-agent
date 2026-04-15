# Finding: 77% Session Interruption Rate

**Date**: 2026-03-17T23:12
**Status**: Active waste — needs investigation
**Impact**: High — most system work is wasted

## Summary

Of the last 30 sessions, **23 (77%) ended as "interrupted"**, only 3 (10%) completed successfully, and 4 (13%) errored. The system is doing enormous work that never reaches completion.

## Key Observations

### Not from process restarts
Interruptions happen individually (not in bulk), ruling out server restart as the cause. Each session ends alone with no error message.

### Pattern by agent (last 30 sessions):
- **May**: 1 op, 12-16s — interrupted almost immediately (idle but still starts a session)
- **Optimizer**: 25-37 ops, 250-500s — hits turn budget before calling finish()
- **Tech-lead**: 43-48 ops — exceeds opBudget (40), gets cut off
- **Coach**: 15-28 ops — variable, sometimes completes
- **Bob**: 2 ops, 168s — very slow, interrupted
- **Evaluator**: 3 ops, 17s — fast interrupt (storm pattern)

### Two mechanisms cause interruptions:

1. **Turn budget (40 turns)** — This is a limit on LLM conversation turns (not state-changing ops). Agents that do complex analysis hit 40 turns and get forcibly stopped. This is different from opBudget. The turn budget warning fires at turn 40, and the session ends without the agent having a chance to call `finish()`.

2. **opBudget enforcement** — When opBudget (40) is exhausted, further writes are blocked but the session continues in read-only mode. However, the agent may not recover gracefully from this and the session eventually times out or hits turn budget.

3. **Idle heartbeats** (May) — The idle-skip logic is supposed to prevent sessions from starting when there's no pending work. May sessions with 1 op suggest the skip isn't working or May finds work during the session that takes exactly 1 op.

## Root Cause: Turn Budget Too Low

The 40-turn budget is the primary bottleneck. Agents doing heartbeat work (read files, analyze, write finding, verify, update periodic-tasks, call finish) need ~15-25 tool calls = 15-25 turns. But they also need turns for:
- Context injection (1-2 turns for system messages)
- Planning text (1-2 turns)  
- Error recovery (2-3 turns if first approach fails)
- Compaction overhead (eats turns)

This regularly pushes past 40 turns, causing the "interrupted" before `finish()` runs.

## Evidence

From my own session history: 20 consecutive "interrupted" sessions, all with the same pattern — "Now let me finish with a clear summary:" in the last message, then interrupted.

## Recommended Fixes

1. **Increase turn budget to 60-80** for heartbeat sessions — heartbeats are the most common session type and they routinely need 40-60 turns
2. **Or reduce heartbeat prompt size** — common-sense.md injection adds ~4K tokens and ~2-3 compaction turns. Consider trimming or removing this injection for well-established agents
3. **May idle-skip fix** — investigate why May starts 1-op sessions; the idle-skip should prevent this
4. **Early finish() training** — agents should call finish() at turn 30, not turn 39

## Cost Impact

At ~30 sessions/6h = 120 sessions/day, if 77% are interrupted:
- ~92 interrupted sessions/day × avg $0.15 startup cost = **~$14/day wasted** on sessions that never deliver results
- The actual work is also lost — agents redo the same analysis next session
