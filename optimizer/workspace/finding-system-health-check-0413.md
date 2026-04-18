# System Health Check — Apr 13, 2026 (~05:22 UTC)

## Overview

6-12 hour system health audit. System ran through a quiet nighttime window (~17:00 Apr 12 to 05:00 Apr 13 UTC). The last 12h have reduced volume but provide a good signal on whether deployed optimizations are holding.

**Bottom line**: All four major optimizations are holding. Daily ops dropped from ~8,000 (Apr 9-10) to ~5,894 (last 24h), a **26% reduction**. Estimated daily cost: ~$277 (down from ~$302).

---

## Optimization Status Table

| Fix | Pre-Fix | Post-Fix (Latest) | Measurement Window | Holding? |
|---|---|---|---|---|
| **D-o-R P1 Budget Cap** (15-op) | P1 avg 31.9 ops | **3.1 avg ops** (n=14, last 24h) | 14 P1 sessions, 100% compliant (≤15) | ✅ YES — improved from 9.4 → 3.1 |
| **D-o-R Full Run** | avg 45.4 ops | **23.3 avg ops** (n=21, last 24h) | 21 workflow runs, median 18, P90=39 | ✅ YES — holding at ~49% reduction |
| **Tech-Lead Heartbeat Bloat** | avg 30.8 ops | **4.3 avg ops** (n=28, last 24h) | 28 heartbeats, max=10 | ✅ YES — stable at 86% reduction |
| **May Heartbeat Budget Cap** | avg 19.2 ops (n=96) | **8.1 avg ops** (n=10, post-fix) | 10 heartbeats since ~15:00 Apr 12 | ✅ YES — 58% reduction, all ≤12 |
| **Optimizer Heartbeat Dispatch** | avg 56 ops | **2.5 avg ops** (n=4, last 12h) | 4 heartbeats, max=4 | ✅ YES — 96% reduction |
| **LLM-to-JS Verification** | ~40 zero-op LLM sessions/day | 12/26 Phase 3 sessions = zero-op | 24h of data | ✅ YES — JS evaluator handling ~46% of P3 verifications |

### Key Improvements Since Last Measurement (Apr 12)

1. **D-o-R P1**: Avg dropped from 9.4 → 3.1 ops. The previous 24h-48h window still had 4 violations (93, 90, 40, 37 ops); the latest 24h has **zero violations**. The cap is fully bedded in.
2. **D-o-R Full Run**: Avg dropped from 25.8 → 23.3 ops. One outlier at 106 ops (a research thread processing run), but median is excellent at 18.
3. **May Heartbeat**: Post-fix sample now at 10 sessions with 8.1 avg. Range: 5-12. Target ≤12 is being met consistently.

---

## Coach 58-Op QA Regression Investigation

- **Session**: `s_1776056469810_18` | Apr 13 05:01 UTC | 58 ops | status: done
- **Task**: "QA C1.4/C8.2 Regression Investigation" — investigating why ~1 in 4 QA sessions end without proper `finish()` call
- **Evaluation**: quality 1, efficiency 0.8, verdict "good"
- **Assessment**: This is a **legitimate work session**, not a regression. It's a coach-dispatched investigation task with inherent complexity (DB queries, code analysis). The 58 ops is high but within the expected range for investigation-type work sessions (coach avg for work sessions: 32.1 ops). Not a pattern — coach heartbeats themselves are lean at 3.8 avg.
- **Status**: One-off. No action needed.

---

## New Anomalies & Optimization Targets

### 1. Tech-Lead Work Sessions: High Volume + Cost (NEW TARGET)
- **34 forked work sessions in 24h**, avg 28.9 ops, total 983 ops (max: 96 ops)
- Tech-lead is now the **highest work-session cost agent** by session count (34 vs coach 27 vs may 17)
- This is the primary cost center: 983 ops from work sessions vs 120 ops from heartbeats = **89% of TL cost is work sessions**
- Several "Lens" analysis sessions running at 15-38 ops — investigative overhead

### 2. Coach Work Sessions Still Costly
- 27 work sessions in 24h, avg 32.1 ops, total 867 ops
- Coach experiments (EXP-*) remain the dominant cost driver
- However, heartbeat dispatch is working well (3.8 avg heartbeat ops)

### 3. Bob Research Thread Outlier
- One 77-op research thread (EXP-148 results processing) at 10:54 Apr 12
- One 41-op heartbeat that dispatched work inline
- The research budget caps seem to be mostly holding — only 2 sessions >30 ops in 24h

### 4. May Work Sessions
- 17 forked sessions, avg 29.6 ops, total 503 ops (max: 51)
- May heartbeats are well-controlled post-fix, but the **dispatched work sessions** are the real cost

---

## Daily Cost Estimate

| Period | Total Ops | Sessions | Est. Cost |
|---|---|---|---|
| Apr 9-10 (pre-fixes) | ~8,016 | 531 | ~$377 |
| Apr 12-13 (latest 24h) | 5,894 | 438 | ~$277 |
| Last 12h (nighttime) | 637 | 61 | ~$60 (projected 24h: ~$277) |

**Overall reduction**: ~26% ($100/day savings from deployed optimizations)

### Cost Breakdown by Agent (last 24h)

| Agent | Ops | Est. Cost | Primary Driver |
|---|---|---|---|
| Coach | 1,167 | ~$55 | Work sessions (experiments) |
| Tech-Lead | 1,129 | ~$53 | Work sessions (lens analyses) |
| Optimizer | 1,041 | ~$49 | Analysis sessions |
| May | 886 | ~$42 | Work sessions |
| Bob | 838 | ~$39 | D-o-R workflow runs |
| Scout | 274 | ~$13 | Heartbeats |
| QA | 251 | ~$12 | Heartbeats |
| Coder | 176 | ~$8 | Code tasks |
| Evaluator | 132 | ~$6 | Evaluations |

---

## Heartbeat Health Summary (last 24h)

All agents' heartbeat costs are healthy:

| Agent | Avg Ops | Max | Status |
|---|---|---|---|
| May | 12.2 | 45 | ⚠️ Some pre-fix data in window. Post-fix: 8.1 avg |
| Bob | 11.2 | 41 | Includes 1 inline-work heartbeat |
| Scout | 9.8 | 18 | Normal |
| QA | 9.0 | 22 | Normal |
| Evaluator | 4.6 | 9 | Normal |
| Tech-Lead | 4.3 | 10 | ✅ Excellent (was 30.8) |
| Optimizer | 4.0 | 13 | ✅ Excellent (was 56) |
| Coach | 3.8 | 9 | ✅ Excellent (was higher) |

---

## Recommendations

1. **May heartbeat**: Continue monitoring. Post-fix sample is only 10 sessions — need ~30+ for confident measurement. Early results excellent (8.1 avg vs 12 target).
2. **Tech-lead work sessions**: New optimization target. 34 sessions/day at 28.9 avg ops is 983 ops/day (~$46/day). Could benefit from session complexity budgets.
3. **No regressions detected**: All four deployed fixes are holding and even improving over time.
4. **D-o-R P1 violation rate**: Zero in last 24h (was 9.5% in previous measurement). The fix is fully adopted.

---

*Analysis performed: Apr 13 2026 ~05:22 UTC. Data window: 12-24h. DB: .state/may.db (20,131 sessions total).*
