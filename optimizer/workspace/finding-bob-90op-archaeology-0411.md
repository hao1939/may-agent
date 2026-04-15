# Finding: Bob 90-op Session Archaeology — Nested Workflow Spawning

**Date**: 2026-04-11 03:24 UTC
**Session investigated**: s_1775863680393_1119 (90 ops, bob, Phase 1)
**Status**: NEW PATTERN — Recursive workflow invocation

## Summary

The 90-op Bob session was caused by **nested workflow spawning** — a D-o-R Phase 1 called `callAgent()` which triggered another D-o-R workflow, creating a 3-deep workflow chain. This is a distinct issue from the P1 read-loop bloat (already fixed). It produced a 169-op session tree for a single KB integration task.

## Session Tree

```
s_1775863419650_1108 | heartbeat (7 ops)
└─ s_1775863474313_1115 | D-o-R P1 (11 ops) [wf=wr_...ctrq]
   └─ s_1775863548477_1117 | callAgent (18 ops) — BRIDGE
      └─ s_1775863620725_1118 | D-o-R P1 (17 ops) [wf=wr_...4bw9]
         └─ s_1775863680393_1119 | D-o-R P1 (90 ops) [wf=wr_...aut5] ← THE 90-OP SESSION
         └─ s_1775864395734_1120 | D-o-R P3 verify (11 ops)
      └─ s_1775864729063_1121 | D-o-R P3 verify (0 ops)
   └─ s_1775864906975_1122 | D-o-R P2 write (15 ops)

Total: 169 ops across 8 sessions for 1 KB integration task
```

## Mechanism

1. **Heartbeat** dispatches "Integrate EXP-128 results" as a D-o-R workflow
2. **D-o-R Phase 1** (11 ops) reads context, then calls `callAgent("bob", ...)` to delegate
3. **callAgent session** (18 ops) receives the task — and Bob's routing triggers ANOTHER D-o-R workflow
4. **Second D-o-R Phase 1** (17 ops) reads context, then its child Phase 1 does the actual work
5. **Third nested Phase 1** (90 ops) — this is the unbounded read loop, pre-budget-cap

The key issue: **Phase 1 should never call `callAgent()`**. The D-o-R workflow already handles delegation via Phase 2. When Phase 1 delegates, it creates a recursive loop.

## Prevalence (last 72h)

Found **3 instances** of nested workflow spawning:

| Parent WF | Child WF | Child ops | Date |
|---|---|---|---|
| wr_...4bw9 | wr_...aut5 | 101 | Apr 10, 23:28 |
| wr_...mxxl | wr_...n7ix | 47 | Apr 9, 09:56 |
| wr_...1v22 | wr_...1u3f | 13 | Apr 9, 06:45 |

Total wasted ops from nesting: **161 ops in 72h** (~54 ops/day, ~$2.50/day).

## Root Cause

Phase 1 is instructed "DO NOT WRITE" but has no instruction against calling `callAgent()`. When the task seems complex, the LLM decides to delegate rather than plan. The callAgent creates a new session, which gets routed through D-o-R again (recursive).

## Relationship to P1 Budget Cap Fix

The budget cap (15-op limit) would **partially** address this because:
- A 15-op budget leaves little room for a Phase 1 to call callAgent
- But it doesn't structurally prevent it

The 90-op session was pre-fix (23:28 UTC, fix deployed at 00:58). With the budget cap, the third nested Phase 1 would have been capped at ~15 ops instead of 90. But the nesting itself (3 workflows × overhead) would still waste ops.

## Recommendation

**Priority: Low-Medium** (~$2.50/day, 54 ops/day)

1. **Quick fix**: Add to Phase 1 prompt: "DO NOT call callAgent() or spawn sub-agents. Phase 2 handles execution."
2. **Structural fix**: Add a `maxDepth` check in the D-o-R workflow — if the session is already inside a D-o-R workflow (detectable via parentSessionId chain), skip the workflow wrapper and run directly.
3. **The budget cap already deployed reduces the damage** — even if nesting occurs, each Phase 1 is capped at 15 ops.

## Comparison to Coach 184-op Session

| Dimension | Coach 184-op | Bob 90-op |
|---|---|---|
| Root cause | Session restarts (7 segments) | Nested workflow spawning |
| Pattern type | Infrastructure (restart accumulation) | Behavioral (recursive delegation) |
| Fix category | Infra (maxRestarts) | Prompt + structural |
| Already addressed? | No (needs infra change) | Partially (P1 budget cap) |
| Daily waste | Unknown | ~54 ops/day |
