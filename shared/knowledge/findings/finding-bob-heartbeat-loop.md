# Finding: Bob Heartbeat Template Loop Bug

**Date:** 2026-03-18T02:04  
**Severity:** HIGH — causes 35% session waste for Bob  
**Status:** NEEDS FIX (by Coach or Bob)

## Problem

Bob's `agents/bob/heartbeat.md` has **stale specific tasks hardcoded in the C40 Promise-Deliver-Report template** (lines 14-18). The template was meant to show the *format* of promises, but instead it contains 4 specific tasks:

1. "Dogfood Checkpoint" — call checkpoint tool natively
2. "Clean Workspace" — deduplicate ideas.md StateLM spam  
3. "Delegate Architecture Update" — P13/P108 SOUL updates
4. "Close Budget Task" — update journal.md re OpBudget

Every time Bob starts a heartbeat, he reads this template and promises these exact 4 tasks. He then fails (checkpoint hits API errors, cleanup fails, delegation gets stuck). Next heartbeat, he reads the same template, promises the same 4 things.

## Evidence

**6-hour window (2026-03-18 ~20:00-02:00 UTC):**
- 52 total Bob sessions, 18 (35%) finish in <30 seconds (no-ops)
- Every Bob session transcript starts with the same 4 promises verbatim
- Bob's active_recall shows **22+ failure modes** in a single day — nearly all traced to these 4 tasks
- 19/52 sessions (37%) FAILED outright

**Root cause:** The heartbeat template has concrete task items where it should have generic examples or dynamic instructions. Bob is trapped in a template-induced Groundhog Day.

## Impact

- **~18 wasted sessions/6h** = 72/day at 660s intervals (should be much less with 1800s)
- **Estimated cost:** $1.80-$9.00/6h in API calls for zero-value sessions
- **Blocks Bob from doing real work:** Instead of reading pending tasks or focus tasks, he gets stuck on the hardcoded promises
- **Evaluator waste:** Each session generates an eval, which triggers re-eval cascade

## Fix

**Option A (Quick — Coach or Bob can do):** Replace the specific tasks in the template with generic examples:
```
**This heartbeat I will:**
1. [first task based on pending injected tasks or focus tasks]
2. [second task]
3. [third task]
```

**Option B (Better):** Remove the hardcoded promises entirely. The C40 convention should say "write YOUR OWN promises based on the current context" — not pre-fill them. The whole point is that the agent decides what to promise based on what's actually needed.

## Why This Matters Beyond Bob

Other agents could develop the same pattern if they write specific tasks into their heartbeat templates. The convention should be clear: heartbeat.md is an *instruction template*, not a *task list*. Specific tasks belong in `todo.md` or the request DB injection.
