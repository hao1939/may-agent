# Finding: Efficiency Gains Scouting — What's Driving the Drops?

**Date**: 2026-04-12 13:54 UTC
**Finding ID**: EFFICIENCY-GAINS-SCOUT-0412
**Status**: ✅ ANALYSIS COMPLETE
**Analysis window**: Last 6h (08:00-14:00 UTC) vs baselines (24-48h ago)

## Executive Summary

Agent efficiency has improved dramatically across the board. The improvements are driven by **three deployed heartbeat rewrites** (optimizer, coach, tech-lead dispatcher modes) and **Bob's workflow phase structure**, not by emergent behavioral changes. May's heartbeat budget cap shows a **bimodal pattern** — the heartbeat itself dropped to 7.0 avg ops, but forked work sessions average 31 ops, making the "total per cycle" actually higher than before.

## Data: Agent-by-Agent Efficiency Trends

### Heartbeat Op Counts (the main cost driver)

| Agent | 48-24h ago | 24-12h ago | 12-6h ago | Last 6h | Change |
|-------|-----------|-----------|----------|---------|--------|
| **Optimizer** | 22.1 avg | 7.7 avg | 3.1 avg | 4.6 avg | **-79%** |
| **Coach** | 13.8 avg | 6.1 avg | 2.8 avg | 3.7 avg | **-73%** |
| **Bob** | 18.3 avg | 10.3 avg | 10.2 avg | 15.6 avg | **-15%** |
| **Tech-lead** | 25.0 avg | 13.8 avg | 18.0 avg | 16.9 avg | **-32%** |
| **May** (actual HB) | — | — | — | 7.0 avg | — |

### Work Session Op Counts

| Agent | 48-24h ago | 24-12h ago | 12-6h ago | Last 6h |
|-------|-----------|-----------|----------|---------|
| **Optimizer** | n/a | 33.8 avg | 26.5 avg | 29.6 avg |
| **Coach** | n/a | n/a | 50.5 avg (n=2) | n/a |
| **Bob** | 22.9 avg | 23.7 avg | 14.2 avg | 12.1 avg |

### System-Wide Trend (total ops per 6h window)

| Window | Total Ops | Sessions | Avg Ops |
|--------|----------|----------|---------|
| Apr 10 14:00-20:00 | 3,361 | 126 | 26.7 |
| Apr 10 20:00-02:00 | 2,157 | 124 | 17.4 |
| Apr 11 02:00-08:00 | 2,067 | 122 | 16.9 |
| Apr 11 08:00-14:00 | 2,896 | 154 | 18.8 |
| Apr 11 14:00-20:00 | 1,720 | 136 | **12.6** |
| Apr 11 20:00-02:00 | 2,686 | 161 | 16.7 |
| Apr 12 02:00-08:00 | 3,034 | 171 | 17.7 |
| Apr 12 08:00-14:00 | 2,297 | 163 | **14.1** |

System-wide avg ops/session dropped from 26.7 → 14.1 (**47% reduction**). But total ops only dropped from 3,361 → 2,297 (**32% reduction**) because session count went UP from 126 → 163 (more granular work = more sessions).

## Root Cause Analysis: What's Driving Each Improvement

### 1. Optimizer Heartbeats: 22.1 → 4.6 avg (-79%) ✅ Deployed Fix

**Cause**: Dispatcher mode heartbeat rewrite (commit `61dfb3c0`, ~36h ago).

The optimizer heartbeat was rewritten to a strict OBSERVE → DECIDE → FORK → EXIT pattern with a 15-op budget. Result:
- Heartbeat median: 3-5 ops (reads todo + DB snapshot + finish)
- All substantive work is forked into separate "Mode A/B/C/D" work sessions
- Work sessions still average 29.6 ops, but they're tracked separately

**Transferable pattern**: YES — this dispatcher pattern has now been deployed to Coach, May, and Tech-lead too.

### 2. Coach Heartbeats: 13.8 → 3.7 avg (-73%) ✅ Deployed Fix

**Cause**: Coach dispatcher mode heartbeat (commit `2e86712a`, hard ≤10 op budget).

Coach went from doing inline investigation (reading sessions, analyzing patterns, running gym scenarios) to a lean triage-and-fork model. The improvement is even more dramatic in median terms:
- 48-24h ago: median 9 ops
- Last 6h: median 4 ops, range 1-9

The 63-op and 52-op coach sessions in last 6h are forked WORK SESSIONS, not heartbeats. Coach heartbeats are now extremely lean.

### 3. May Heartbeats: Bimodal Pattern (7.0 avg HB + 31.0 avg forked work)

**Cause**: May heartbeat budget cap (commit `faf6115b`, deployed ~6h ago).

May shows a clear bimodal pattern after the budget cap:
- **Actual heartbeats**: 4, 5, 6, 7, 7, 7, 7, 7, 6, 7, 5 → avg 7.0 ops ✅
- **Forked work**: 44, 28, 26, 33, 34, 23, 29 → avg 31.0 ops

The budget cap is working perfectly for the heartbeat itself. However, May forks substantial work sessions almost every cycle (~7 forks in 11 heartbeats = 64% fork rate). **Total per-cycle cost is ~38 ops**, which is actually higher than the old 22.4 avg.

**Key insight**: The budget cap succeeded at making heartbeats lean but didn't reduce total cost — it just moved the cost to forked sessions. Whether this is better depends on whether the forked work is more focused and productive than inline investigation was.

### 4. Bob Work Sessions: 22.9 → 12.1 avg (-47%) 🔬 Workflow Phase Structure

**Cause**: Bob's 3-phase workflow (Phase 1: Analyze, Phase 2: Write, Phase 3: Verify) with per-phase budgets.

Phase breakdown (last 12h):
- **Phase 1 (Analyze)**: median 3 ops, avg 3.3 (excluding 2 outliers at 90, 93)
- **Phase 2 (Write)**: avg 10.8 ops
- **Phase 3 (Verify)**: avg 4.7 ops
- **Research Threads**: avg 20.4 ops (includes one 77-op outlier)
- **Research Synthesis**: avg 10.5 ops

The workflow structure creates many small, focused sessions instead of one large one. A typical workflow run is 3 phases totaling ~18-22 ops, broken into focused steps.

**D-o-R Phase 1 cap status**: Still largely effective — median 3 ops. But 4 cap violations in last 24h (37, 40, 90, 93 ops), suggesting the cap enforcement may have a bug or the violating sessions don't go through the same path.

### 5. Tech-lead Heartbeats: 25.0 → 16.9 avg (-32%) ✅ Deployed Fix

**Cause**: Dispatcher mode heartbeat (commit `dfa10146`) + hard ≤10 op budget (commit `2e86712a`).

Moderate improvement but less dramatic than optimizer/coach. Tech-lead still does some inline work during heartbeats, suggesting the dispatcher pattern isn't as strictly enforced.

## Transferable Patterns

### Pattern 1: Dispatcher Mode Heartbeats
**Effectiveness**: Extremely high for heartbeat cost reduction (73-79% for optimizer/coach).
**Already deployed to**: Optimizer, Coach, May, Tech-lead.
**Not yet deployed to**: Bob, Scout, Amy-kimi, QA, Coder.

### Pattern 2: Per-Phase Budget Caps in Workflows
**Effectiveness**: Bob's phase structure drives work sessions to ~18-22 ops total vs unstructured sessions at 30+ ops.
**Mechanism**: Breaking work into Analyze (≤15 ops) → Write (≤25 ops) → Verify (read-only) creates natural stopping points.
**Transferable to**: Coach work sessions (currently avg 50+ ops), May forked work (currently avg 31 ops).

### Pattern 3: Research Thread + Synthesis Separation
**Effectiveness**: Bob's research threads avg 20.4 ops; synthesis passes avg 10.5 ops. Separation prevents scope creep.
**Mechanism**: Research threads focus on one topic, then a separate synthesis step combines results.
**Transferable to**: Any agent doing multi-topic investigation work.

## Remaining Issues

1. **May's total cost didn't decrease** — budget cap just moved cost to forked sessions. Need to measure if the forked work is actually higher quality.
2. **Bob Phase 1 cap violations** — 4 sessions >30 ops in last 24h (90, 93, 40, 37). The cap enforcement may have gaps.
3. **Optimizer work sessions still average 29.6 ops** — the heartbeat is lean but work sessions remain expensive. Some (61 ops) are archaeology sessions that may be inherently expensive.
4. **Coach work sessions are still very expensive** when they happen (52, 63 ops in last 6h). The dispatcher model hasn't solved work session cost, only heartbeat cost.

## Conclusions

The efficiency gains are **real and substantial** — system-wide avg ops/session dropped 47% (from 26.7 to 14.1). The gains are almost entirely attributable to three deployed interventions:

1. **Dispatcher mode heartbeats** (3 agents) — 73-79% heartbeat reduction
2. **Budget caps** (per-step and per-phase) — enforcing natural stopping points
3. **Bob's workflow phase structure** — 47% work session reduction

There are **no significant emergent behavioral improvements** — the gains are from deliberate structural changes. The next frontier is:
- **Work session cost optimization** — heartbeats are now lean; work sessions (29-51 avg) are the new cost center
- **May forked work quality** — verify the dispatcher model produces better outcomes, not just cheaper heartbeats
- **Phase 1 cap enforcement** — investigate why 4 sessions violated the 15-op cap

---
*Optimizer agent — session s_1776002056765_2158*
*Data source: .state/may.db*
