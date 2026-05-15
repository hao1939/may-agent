# Finding: Optimizer Heartbeat Bloat v2 — Post-Fix Analysis

**Date**: 2026-04-10 18:54 UTC  
**Analyst**: optimizer (work session from coach)  
**Status**: Dispatcher Mode fix deployed at 17:45 UTC; early results are promising

---

## Executive Summary

The optimizer's heartbeat bloat problem has **two distinct phases**:

1. **Pre-bloat** (Apr 8-9, Apr 10 00:00-06:00): Avg 2.5-4.0 ops/HB. Explorer Mode heartbeat but nothing to explore — clean observe+exit.
2. **Bloat period** (Apr 10 06:00-17:45): Avg 41.3 ops/HB, 100% of heartbeats >15 ops. Explorer Mode heartbeat with active inline exploration — every heartbeat ran full analysis cycles.
3. **Post-fix** (Apr 10 17:45+): Avg 8.3 ops/HB across 3 heartbeats. Dispatcher Mode deployed. Early results on target.

**Key insight**: The problem wasn't the heartbeat.md text per se — it was that once the optimizer had "things to work on" (starting ~06:00 Apr 10), Explorer Mode instructed it to do the work *inline* rather than fork. The Dispatcher Mode fix correctly addresses this by requiring all exploration to be forked.

---

## Pre/Post Comparison

| Period | Dates | HBs | Avg Ops | Max Ops | >15 ops | Total Ops | Cost |
|--------|-------|-----|---------|---------|---------|-----------|------|
| **Baseline (Apr 8)** | Apr 8 full day | 35 | 4.0 | 12 | 0 (0%) | 141 | ~$2/day |
| **Baseline (Apr 9)** | Apr 9 full day | 48 | 2.9 | 15 | 0 (0%) | 139 | ~$2/day |
| **Pre-bloat (Apr 10)** | 00:00-06:00 | 12 | 2.5 | 6 | 0 (0%) | 30 | ~$0.60 |
| **BLOAT (Apr 10)** | 06:00-17:45 | 23 | **41.3** | **75** | **23 (100%)** | **949** | **$16.35** |
| **Post-fix (Apr 10)** | 17:45-18:54 | 3 | **8.3** | 16 | 1 (33%) | 25 | **$0.27** |

**Extrapolated daily cost**:
- Lean heartbeats (baseline rate): ~$3.75/day
- Bloat rate (if sustained 24h): ~$33/day  
- Savings from Dispatcher Mode: **~$14.59/day** (measured) to **~$29/day** (extrapolated)

---

## What Caused the Bloat Spike at 06:00?

The optimizer heartbeat used "Explorer Mode" from Apr 8 onward. During Apr 8-9 and Apr 10 00:00-06:00, the heartbeats were lean because:

- **Nothing to explore**: System was healthy, no anomalies, no pending tasks
- **Clean observe-and-exit**: 1 DB query → "all healthy" → finish

At 06:00 Apr 10, the optimizer found things to work on (accumulated todo items, measurement tracking, findings to write). Explorer Mode told it to **do the work inline**:

> "Pick ONE of these exploration modes (rotate each heartbeat): Mode A: Session Archaeology... Mode B: Tool Gap Analysis..."

The heartbeat text implied these modes should run *within* the heartbeat, not as forked sessions. Result: every heartbeat from 06:00 onward ran full exploration cycles inline.

---

## Breakdown: What Eats Ops in Bloated Heartbeats

Based on analysis of 23 bloated heartbeats (949 total ops):

### 1. Inline Exploration & Analysis (~40% of ops)
The optimizer runs multi-step DB queries, reads files, and writes findings **inside the heartbeat** instead of forking. This is the root cause.

Examples:
- 06:23 (50 ops): Full Mode A Session Archaeology — queried DB, analyzed bob heartbeats, wrote finding, sent to May
- 12:53 (51 ops): Read deliver-or-report.ts, analyzed Phase 2 waste, updated todo
- 14:53 (75 ops): Multi-file analysis, 1.19M input tokens ($3.89 in one heartbeat)

### 2. Todo.md Update Cycles (~30% of ops)
Every heartbeat that did work also updated `todo.md`:
- Read current todo → edit → git add → git commit → verify

19 of 23 bloated heartbeats mention "verification" in their outcome. The pattern is:
1. Do analysis work (10-30 ops)
2. Write to todo.md (2-3 ops)
3. Git commit (1-2 ops)
4. Verify the edit (1-3 ops)
5. finish() (1 op)

### 3. Large File Reads (~15% of ops, 49% of cost)
Three outlier sessions read massive amounts of data:

| Time | Ops | Input Tokens | Cost | What |
|------|-----|-------------|------|------|
| 13:23 | 46 | 613,766 | $2.07 | Unknown large read |
| 14:53 | 75 | 1,185,928 | $3.89 | Multi-file analysis |
| 16:23 | 50 | 583,178 | $2.06 | Todo.md condensation |

These 3 sessions = $7.97 = **49% of bloat-period cost** despite being only 13% of sessions.

### 4. Verification/Guard Loops (~15% of ops)
The finish() guard requires post-edit verification. 4 of 23 sessions explicitly mention the guard rejecting their first finish attempt, requiring re-verification. This adds 2-5 ops per occurrence.

---

## Post-Fix Assessment

The Dispatcher Mode heartbeat (deployed 17:45 UTC) makes these structural changes:

1. **Budget enforcement**: "≤15 ops" target stated explicitly
2. **Must-fork list**: All exploration modes, multi-query analysis, coding, findings
3. **Quick-inline limit**: Only todo notes, metric checks, dispatch acknowledgments
4. **Fork template**: Structured fork with objectives and deliverables

### Early Results (3 heartbeats):

| Time | Ops | What |
|------|-----|------|
| 17:53 | 16 | Transitional — completed prior work, just over target |
| 18:23 | 4 | Clean observe → fork work session → exit |
| 18:53 | 5 | Clean observe → fork work session → exit |

The 18:23 and 18:53 sessions are **exactly what we want**: observe quickly, fork a work session, exit. 4-5 ops.

### Forked Work Sessions Post-Fix:
- 17:29 (17 ops): Gym data gap fix
- 17:55 (19 ops): Gym recording implementation  
- 18:24 (70 ops): Mode B tool gap analysis (coach sessions)
- 18:54 (this session): Mode A session archaeology

The exploration work that previously bloated heartbeats is now in separate, properly-scoped work sessions.

---

## Remaining Risks

### 1. Dispatcher Mode May Drift
The optimizer ran lean heartbeats for 2+ days (Apr 8-9) under Explorer Mode too — simply because it had nothing to do. The real test is whether Dispatcher Mode holds when there IS work. We need 24h+ of active-period data.

### 2. First Post-Fix Heartbeat Was 16 Ops
The 17:53 session was transitional but still over the 15-op target. It was likely completing prior work. Monitor whether this settles.

### 3. Todo.md Update Tax
Even in lean heartbeats (Apr 9), the highest-op ones (7-15 ops) were doing todo.md updates. The edit→commit→verify cycle is inherent overhead. If the optimizer updates todo.md every few heartbeats, that's 5-8 ops per update.

**Potential fix**: Batch todo updates — only update every N heartbeats, or keep a local scratch buffer and commit periodically.

### 4. Large File Reads Are Cost Outliers
3 sessions with >500K input tokens drove 49% of bloat-period cost. These happen when the optimizer reads large source files or database outputs inline. Fork-mode should prevent this, but watch for it.

---

## Actionable Fixes

### Already Done ✅
1. **Dispatcher Mode heartbeat** — Rewrote heartbeat.md with fork-first discipline, budget enforcement, must-fork list. Deployed 17:45 UTC Apr 10.

### Recommended Next
2. **Monitor for 24h** — Collect data through Apr 11. Target: avg ≤10 ops/HB, 0% >15 ops during active periods.
3. **Todo.md update batching** — Add guidance: "Don't update todo.md every heartbeat. Keep a mental list and update once every 3-4 heartbeats."
4. **Work session op budget** — Forked sessions don't have an op budget. The Mode B session at 18:24 used 70 ops. Consider adding guidance for scoping work sessions.
5. **Cost monitoring** — Add heartbeat cost tracking to todo.md measurements section. Flag any heartbeat >$0.50.

---

## Evidence Table

| Session ID | Time (UTC) | Ops | Turns | Input Tokens | Cost | Period |
|-----------|-----------|-----|-------|-------------|------|--------|
| s_1775780618035_607 | 00:23 | 3 | - | - | - | lean |
| s_1775782417950_616 | 00:53 | 6 | - | - | - | lean |
| s_1775784217913_625 | 01:23 | 4 | - | - | - | lean |
| s_1775786018074_634 | 01:53 | 3 | - | - | - | lean |
| s_1775787818063_642 | 02:23 | 3 | - | - | - | lean |
| s_1775789618272_650 | 02:53 | 1 | - | - | - | lean |
| s_1775791417434_661 | 03:23 | 1 | - | - | - | lean |
| s_1775793217834_670 | 03:53 | 1 | - | - | - | lean |
| s_1775795018153_683 | 04:23 | 3 | - | - | - | lean |
| s_1775796818303_697 | 04:53 | 1 | - | - | - | lean |
| s_1775798617676_710 | 05:23 | 3 | - | - | - | lean |
| s_1775800417882_723 | 05:53 | 1 | - | - | - | lean |
| s_1775802217214_735 | 06:23 | 50 | 59 | 148,277 | $0.73 | **bloat** |
| s_1775804017964_747 | 06:53 | 41 | 43 | 45,745 | $0.30 | **bloat** |
| s_1775805818667_759 | 07:23 | 30 | 27 | 43,255 | $0.28 | **bloat** |
| s_1775807618704_769 | 07:53 | 28 | 45 | 112,436 | $0.56 | **bloat** |
| s_1775809417143_781 | 08:23 | 34 | 31 | 161,918 | $0.66 | **bloat** |
| s_1775811217404_791 | 08:53 | 43 | 53 | 59,618 | $0.42 | **bloat** |
| s_1775813017781_804 | 09:23 | 31 | 41 | 64,410 | $0.37 | **bloat** |
| s_1775814818286_817 | 09:53 | 27 | 35 | 50,881 | $0.31 | **bloat** |
| s_1775816617401_830 | 10:23 | 42 | 53 | 56,741 | $0.36 | **bloat** |
| s_1775818418103_839 | 10:53 | 29 | 37 | 45,394 | $0.28 | **bloat** |
| s_1775820217222_849 | 11:23 | 46 | 50 | 140,383 | $0.64 | **bloat** |
| s_1775822018315_857 | 11:53 | 29 | 36 | 47,765 | $0.31 | **bloat** |
| s_1775823817485_869 | 12:23 | 36 | 43 | 52,700 | $0.33 | **bloat** |
| s_1775825617382_878 | 12:53 | 51 | 54 | 63,515 | $0.42 | **bloat** |
| s_1775827417118_887 | 13:23 | 46 | 59 | 613,766 | $2.07 | **bloat** (outlier) |
| s_1775829217329_896 | 13:53 | 40 | 55 | 58,566 | $0.37 | **bloat** |
| s_1775831018985_910 | 14:23 | 32 | 32 | 47,690 | $0.31 | **bloat** |
| s_1775832818174_918 | 14:53 | 75 | 70 | 1,185,928 | $3.89 | **bloat** (outlier) |
| s_1775834617784_928 | 15:23 | 52 | 51 | 59,858 | $0.46 | **bloat** |
| s_1775836418865_939 | 15:53 | 30 | 39 | 50,417 | $0.34 | **bloat** |
| s_1775838218995_950 | 16:23 | 50 | 61 | 583,178 | $2.06 | **bloat** (outlier) |
| s_1775840018557_962 | 16:53 | 57 | 58 | 59,041 | $0.46 | **bloat** |
| s_1775841819388_972 | 17:23 | 50 | 60 | 63,056 | $0.44 | **bloat** |
| s_1775843619393_982 | 17:53 | 16 | 20 | 31,969 | $0.17 | **post-fix** |
| s_1775845419395_995 | 18:23 | 4 | 11 | 20,804 | $0.10 | **post-fix** |
| s_1775847219395_1006 | 18:53 | 5 | - | - | - | **post-fix** |

---

## Summary Statistics

| Metric | Bloat Period (06:00-17:45) | Post-Fix (17:45+) | Improvement |
|--------|--------------------------|-------------------|-------------|
| Avg ops/HB | 41.3 | 8.3 | **5x reduction** |
| Total ops | 949 (23 HBs) | 25 (3 HBs) | — |
| Cost | $16.35 (11.75h) | $0.27 (1.15h) | **~89% cheaper** |
| Cost/hour | $1.39/hr | $0.23/hr | **6x reduction** |
| >15 ops rate | 100% | 33% | — |
| Forked work sessions | 2 | 3 | More forking ✓ |
