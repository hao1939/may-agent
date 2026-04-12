# Finding: D-o-R Phase 1 Cap & Heartbeat Budget — Update 5 (n=27 heartbeats, n=14 Phase 1s)

**Date**: 2026-04-11 14:55 UTC (~14h post P1 cap, ~2.5h post Phase 2 fix)  
**Fix 1**: Phase 1 budget cap (commit 40b22057, deployed ~00:58 UTC)  
**Fix 2**: Anti-nesting instruction (commit 60a844e3, deployed ~03:54 UTC)  
**Fix 3**: Phase 2 callAgent guard (commit ef7e2528, deployed ~12:09 UTC)  
**Status**: ✅ P1 CAP CONFIRMED (n=14, 0 violations) | ⚠️ HEARTBEAT BUDGET EXCEEDS 15 ops 19% of time

## Phase 1 Budget Cap: ✅ PERFECT COMPLIANCE (n=14)

All 14 Phase 1 sessions since the cap commit have stayed within the 15-op ceiling:

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Count | 14 | ≥20 | 📈 Growing |
| P1 mean | **4.4 ops** | ≤15 | ✅ |
| P1 median | **4** | ≤15 | ✅ |
| P1 max | **11** | ≤15 | ✅ |
| P1 min | 0 (running) | — | — |
| Violations (>15) | **0** | 0 | ✅ |

**Distribution (n=14):** `[0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 7, 11]`

**P1 cap is rock-solid.** 14 consecutive runs, zero violations, average 4.4 ops vs pre-fix 28.7 = **85% reduction**. The 15-op budget cap prompt is highly effective.

## Bob Heartbeat Budget: ⚠️ 19% VIOLATION RATE (n=27)

The 15-op cap applies to Phase 1, but heartbeats (which dispatch work) don't have an explicit budget cap. Since the cap commit:

| Metric | Value |
|--------|-------|
| Completed heartbeats | 27 |
| Mean ops | **10.0** |
| Median ops | **7** |
| Max ops | **42** |
| ≤7 ops (lean) | 17/27 (63%) |
| >15 ops | 5/27 (19%) |

### Heartbeat Violation Analysis

| Session | Ops | Time | Children | Pattern |
|---------|-----|------|----------|---------|
| s_1775874219713 | **42** | 02:23 | 3 forks | Multi-thread research synthesis dispatch |
| s_1775885020113 | **17** | 05:23 | 2 forks | D-o-R dispatch (P1+P2) |
| s_1775904820244 | **30** | 10:53 | 0 forks | Solo work — no dispatch, just reading/writing |
| s_1775912021068 | **20** | 12:53 | 2 forks | D-o-R dispatch + work |
| s_1775915621641 | **20** | 13:53 | 0 forks | Solo work |

**Observation**: Heartbeat bloat comes from two patterns:
1. **Heavy dispatch heartbeats** (42, 17, 20 ops): Read context → analyze → fork multiple work sessions. The dispatch overhead itself is the cost.
2. **Solo-work heartbeats** (30, 20 ops): The heartbeat does substantial direct work instead of dispatching. This is the more concerning pattern — heartbeats doing work they should delegate.

### Heartbeat vs Phase 1 Comparison

| Metric | Phase 1 (n=14) | Heartbeat (n=27) |
|--------|:-:|:-:|
| Mean ops | 4.4 | 10.0 |
| Median ops | 4 | 7 |
| Max ops | 11 | 42 |
| >15 rate | 0% | 19% |

Phase 1 has an explicit "BUDGET: 15 TOOL CALLS MAX" prompt. Heartbeats don't. The cap works when present.

## Pre-Fix vs Post-Fix Summary (Phase 1 Focus)

| Metric | Pre-Fix (n=49) | Post-Fix (n=14) | Target | Status |
|--------|:-:|:-:|:-:|:-:|
| P1 mean | 28.7 | **4.4** | ≤15 | ✅ |
| P1 max | 87 | **11** | ≤15 | ✅ |
| P1 bloated (>40 ops) | 31% | **0%** | ≤10% | ✅ |
| Violations (>15) | ~43% | **0%** | 0% | ✅ |

## Potential Next Action

The heartbeat budget isn't part of the D-o-R fix scope, but the data suggests a similar prompt-based cap could work for heartbeats. The 63% already-lean rate suggests most heartbeats naturally stay efficient — only the 19% that do direct work or heavy dispatch exceed 15 ops. A "BUDGET: 15 TOOL CALLS" instruction in the heartbeat prompt could eliminate this without changing behavior for the majority.

**However**: Heartbeat bloat may be intentional — some tasks genuinely need multi-fork dispatch that takes 20+ ops of context reading. This warrants separate analysis before applying a cap.

## Data Source

- **DB**: `.state/may.db`
- **P1 query**: `agent='bob' AND task LIKE '%Phase 1%' AND startedAt > 1775866543000`
- **Heartbeat query**: `agent='bob' AND task LIKE '[heartbeat]%' AND startedAt > 1775866543000`

---
*Optimizer | Session s_1775919270991_1478 | 2026-04-11 ~14:55 UTC*
