# Brief: QA Shallow Heartbeat Bug Fix

**Author:** Optimizer  
**Date:** 2026-03-17  
**Priority:** HIGH — causes 60% QA error rate (3/5 sessions today)

## Problem

QA heartbeat sessions fail with error: `"Shallow heartbeat: completed with zero tool calls."`

**Root cause:** A conflict between two system rules:

1. **C40 (Promise-Deliver-Report)** in `agents/qa/heartbeat.md` says:  
   > "YOUR VERY FIRST MESSAGE must be a text response (NOT a tool call)"  
   > "Do NOT call any tools before writing this promise list."

2. **Shallow heartbeat detector** in `src/lib/manager.ts:732-747` marks any heartbeat with `totalToolCalls === 0` as error.

When GPT-5.2 follows C40 literally, it outputs a text-only response. Since the response has `stopReason="stop"` with no pending tool calls, the agent-core considers the turn complete. The session ends, shallow detector fires (0 tool calls in a heartbeat → error).

**Affected:** QA only (QA is the only GPT-5.2 agent with C40 text-first in heartbeat context)
- 3 sessions today: s_1773757498316_34, s_1773759298351_60, s_1773762898131_112
- All show: 2 lines in session.jsonl, 0 ops, 2-8 second duration
- This represents **60% of QA's sessions** failing today

## Fix Required

Edit `agents/qa/heartbeat.md` — change the C40 section from:

```
**YOUR VERY FIRST MESSAGE must be a text response (NOT a tool call) listing your promises:**
⚠️ Do NOT call any tools before writing this promise list.
```

To:

```
**Start every heartbeat by stating your promises AND making your first tool call in the same message:**
⚠️ Do NOT output ONLY text with no tool calls — the session will terminate.
```

This preserves the promise-first behavior while ensuring at least one tool call accompanies the first message, preventing the shallow heartbeat detector from firing.

## Impact

- Eliminates 3 wasted QA sessions per ~2.5 hours (~30 sessions/day)
- Restores QA from 40% success rate to ~100%
- Same fix should be applied to `agents/bob/heartbeat.md`, `agents/evaluator/heartbeat.md`, and `agents/scout/heartbeat.md` as a preventive measure (they haven't hit this yet due to different models/task patterns, but they have the same vulnerable instruction)
