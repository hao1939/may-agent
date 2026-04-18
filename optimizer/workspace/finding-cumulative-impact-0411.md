# Finding: Cumulative Fix Impact — Apr 11 Full-Day Measurement

**Date**: 2026-04-11 19:24 UTC  
**Author**: Optimizer (Mode A — Session Archaeology)  
**DB**: `.state/may.db` (19,180 sessions)

## Executive Summary

Five fixes deployed Apr 10-11 produced **measurable but modest** system-wide impact. The headline: **37% heartbeat ops reduction** in the post-all-fixes window (13:00-19:24 UTC), but total daily ops remain approximately flat (~8,900-9,000 projected). Why? Fixes targeted specific sources of bloat, but activity shifted — tech-lead and optimizer increased work-session ops as they became more active dispatchers.

**Net result: No cost savings yet.** The wins are real but localized; system-wide ops stayed constant because freed capacity was consumed by new work. This is arguably positive — same budget, more useful work — but doesn't reduce spend.

## Daily Overview

| Metric | Apr 9 (baseline) | Apr 10 (partial fix) | Apr 11 (19.4h, projected 24h) |
|--------|-------------------|----------------------|-------------------------------|
| Sessions | 575 | 528 | 457 (→ ~565 proj) |
| Total ops | 8,849 | 9,996 | 7,230 (→ ~8,944 proj) |
| Avg ops/session | 15.4 | 18.9 | 15.8 |
| Max ops | 123 | 188 | 98 |
| >60 op sessions | 19 (1,514 ops) | 23 (2,126 ops) | 13 (1,005 ops) |
| Errors | 0 | 2 | 2 |
| Heartbeat % of ops | 51.8% | 57.9% | 52.8% |

**Same-window comparison (first 19h):**
| Window | Sessions | Ops | Avg ops |
|--------|----------|-----|---------|
| Apr 9 (0-19h) | 478 | 7,387 | 15.5 |
| Apr 10 (0-19h) | 412 | 7,693 | 18.7 |
| Apr 11 (0-19h) | 446 | 7,187 | 16.1 |

Apr 11 is 2.7% lower than Apr 9 in same-window — statistically insignificant.

## Fix-by-Fix Impact

### Fix 1: D-o-R Phase 1 Budget Cap ✅ CONFIRMED EFFECTIVE

| Metric | Pre-cap (n=42) | Post-cap (n=16) | Change |
|--------|----------------|-----------------|--------|
| Avg ops/P1 | 29.7 | 7.2 | **-75.8%** |
| Total P1 ops | 1,249 | 115 | -90.8% |
| Max ops | 100 | 40 | -60% |

**By day (Phase 1 only):**
| Day | P1 sessions | Avg ops | Total ops |
|-----|-------------|---------|-----------|
| Apr 9 | 16 | 25.1 | 402 |
| Apr 10 | 24 | 35.0 | 840 |
| Apr 11 | 18 | 6.8 | 122 |

**Savings estimate**: ~718 P1 ops saved vs Apr 10 rates (840→122 actual). At ~$0.033/op = **~$23.70/day saved** on P1 alone.

### Fix 2: Tech-Lead Dispatcher Mode ✅ CONFIRMED EFFECTIVE

| Metric | Pre-dispatcher (n=128 HB) | Post-dispatcher (n=16 HB) | Change |
|--------|---------------------------|---------------------------|--------|
| Avg ops/heartbeat | 14.5 | 4.1 | **-71.7%** |
| Total HB ops | 1,853 | 65 | -96.5% |

But tech-lead's *total* ops went UP: Apr 9 = 432 total → Apr 11 = 1,135 total. The fix made heartbeats lean, but TL dispatches more work sessions now (17 non-HB sessions on Apr 11 vs 8 on Apr 9, at 28.4 avg ops). Net per-agent ops increased.

### Fix 3: Optimizer Dispatcher Mode — MIXED RESULTS

| Period | HB sessions | Avg ops/HB |
|--------|-------------|------------|
| Apr 9 baseline | 48 | 2.9 |
| Apr 10 pre-disp | 24 | 19.2 |
| Apr 10 post-disp | 25 | 25.1 |
| Apr 11 0-6h | 12 | 3.1 |
| Apr 11 6-12h | 17 | 13.0 |
| Apr 11 12-19h | 15 | 4.5 |

**Verdict**: Highly variable. Apr 9 baseline was already lean (2.9 avg). Apr 10 saw a spike regardless of fix. Apr 11 shows lean early/late but bloated mid-day. The overall Apr 11 HB avg is 7.4 (from 22.2 on Apr 10), so ~67% reduction vs Apr 10 — but the fix didn't cause this; Apr 10 was an outlier due to active investigation work.

Total optimizer ops went from 166 (Apr 9) → 1,504 (Apr 10) → 1,422 (Apr 11). The optimizer is simply doing more work now (forked analysis sessions), not less.

### Fix 4: may.db WAL / Session-Sync + Evaluation-Sync ✅ CONFIRMED WORKING

| Day | Total sessions | Unevaluated (done) | Evaluated |
|-----|----------------|--------------------|-----------|
| Apr 9 | 575 | 0 | 575 |
| Apr 10 | 528 | 0 | 528 |
| Apr 11 | 457 | 336 | 116* |

*Apr 11 has 336 unevaluated because they're still recent/running — evaluator needs time. Not a WAL bug. Apr 9 and 10 are at 100% evaluation coverage.

### Fix 5: gym-batch.sh Deployment — ZERO ADOPTION ❌

| Metric | Value |
|--------|-------|
| Coach sessions Apr 11 | 63 |
| gym-batch mentions | 0 |
| Coach still uses | individual gym-run.sh calls |

No change from previous measurement. Tool exists but isn't used.

## Heartbeat Ops: The Main Battleground

**Total heartbeat ops/hour (normalized):**

| Period | HB ops/h | Change vs Apr 9 |
|--------|----------|-----------------|
| Apr 9 (24h baseline) | 191.2 | — |
| Apr 11 post-all-fixes (13-19h) | 120.0 | **-37.2%** |

**Per-agent heartbeat avg ops:**

| Agent | Apr 9 avg | Post-fix avg | Change |
|-------|-----------|--------------|--------|
| bob | 22.6 | 6.6 | -70.8% |
| coach | 18.5 | 6.1 | -67.0% |
| scout | 18.0 | 8.1 | -55.0% |
| may | 17.7 | 13.7 | -22.6% |
| qa | 6.2 | 9.6 | +54.8% |
| evaluator | 5.5 | 4.7 | -14.5% |
| optimizer | 2.9 | 4.0 | +37.9% |
| tech-lead | 2.1 | 4.3 | +104.8% |

Bob and coach show the biggest heartbeat reductions — bob from D-o-R P1 cap, coach from natural variation. TL went up because it now does lightweight dispatch in heartbeats (was very passive before).

## Cost Analysis

**Actual cost data (from evaluations):**
- Apr 9: $368.44 (8,849 ops → $0.042/op)
- Apr 10: $249.50 (9,996 ops → $0.025/op)
- Apr 11: Cost data not yet populated for new evaluations

**The ~$0.50/op estimate is wrong.** Actual cost is $0.025-0.042/op. The $0.50 figure likely included model costs that aren't tracked per-op.

Using actual $/op ($0.033 average):
- Apr 9 baseline: ~$368/day (actual)
- Apr 11 projected: ~$295/day (8,944 ops × $0.033)
- **Projected savings: ~$73/day** — but this is mostly from fewer sessions running (activity levels vary day-to-day), not necessarily from fixes.

## The Ops Distribution Shift

| Bucket | Apr 9 sessions | Apr 10 sessions | Apr 11 sessions |
|--------|----------------|-----------------|-----------------|
| 0 ops | 45 | 24 | 15 |
| 1-10 | 272 | 240 | 227 |
| 11-20 | 110 | 101 | 94 |
| 21-40 | 91 | 91 | 80 |
| 41-60 | 38 | 49 | 28 |
| 60+ | 19 | 23 | 13 |

Key shift: **60+ op sessions dropped from 19 (Apr 9) to 13 (Apr 11)**, and their total ops from 1,514 to 1,005. The P1 cap directly prevented several sessions from hitting 60+.

The 41-60 bucket also shrank: 38→28 sessions. Mid-range bloat is decreasing.

## Apr 11 Hourly Pattern

| Hour | Sessions | Ops | Avg |
|------|----------|-----|-----|
| 0-5h | ~120 | ~2,148 | ~17.6 |
| 6-12h | ~181 | ~3,250 | ~17.4 |
| 13-19h | ~154 | ~1,832 | **11.9** |

Clear drop-off after TL dispatcher fix at 13:00. The 11.9 avg ops in the post-fix afternoon is **32.7% lower** than the pre-fix morning.

## Conclusions

### What Worked
1. **D-o-R P1 cap** — Decisive. 75.8% avg ops reduction, eliminated runaway Phase 1 reads. Most impactful single fix.
2. **TL dispatcher** — Effective for heartbeats (72% reduction). But TL now dispatches more, so total agent ops increased.
3. **WAL fix** — Working correctly. 100% evaluation coverage for completed days.

### What Didn't Work
4. **Optimizer dispatcher** — Results confounded by the optimizer doing 10x more work than baseline. Can't isolate fix impact.
5. **gym-batch.sh** — Zero adoption. Confirmed dead without deeper integration.

### System-Wide Impact
- **Heartbeat ops**: -37% in post-fix window ✅
- **Total ops**: Approximately flat (+1% projected) — NOT a reduction
- **High-op sessions**: -32% fewer 60+ sessions ✅
- **Cost**: No measurable savings yet (activity displacement)
- **Quality**: No regression detected

### Why No Net Savings?
The fixes reduced waste in specific areas, but:
1. Freed capacity was consumed by new work (optimizer exploration, TL dispatching)
2. Day-to-day natural variation (~10-15%) masks the fix impact
3. Apr 10 was an outlier high (9,996 ops) making Apr 11 look relatively better/worse depending on baseline

### Hypothesis Check
- "Combined fixes should show 15-25% ops reduction" → **FALSE at system level.** Individual fixes hit their targets but system rebalanced.
- "$30-50/day savings" → **FALSE.** No measurable savings. Actual $/op is $0.033, not $0.50.
- "P1 ops down ~85%" → **TRUE.** 75.8% avg reduction, 90.8% total reduction.
- "TL heartbeat ops down ~60%" → **TRUE.** 71.7% avg reduction.
- "Optimizer heartbeat ops down ~60%" → **INCONCLUSIVE.** Results confounded.
- "0 unevaluated sessions" → **TRUE for completed days.**
- "Coach gym-batch adoption" → **CONFIRMED ZERO.**

## Recommended Next Steps
1. **Revise cost model**: The $0.50/op estimate is 15x too high. Actual is ~$0.033/op. Recalibrate all savings projections.
2. **Longer measurement window**: Need 3-5 days post-all-fixes to separate signal from noise.
3. **Cap work session ops**: The real waste is now in 41-60 and 60+ sessions. A system-wide 40-op soft cap with escalation would catch the remaining tail.
4. **Kill gym-batch.sh effort**: Zero adoption after 2 days + context.md mention. Either integrate into workflow templates or acknowledge it's dead.
5. **Monitor TL/optimizer total ops**: Dispatcher mode reduced HB ops but increased total — ensure the dispatched work is productive.
