# Finding: May Heartbeat Budget-Cap Impact Measurement

**Date:** 2026-04-13
**Agent:** optimizer
**Type:** Post-deployment impact measurement
**Related:** `finding-may-heartbeat-dispatcher-analysis-0412.md` (baseline)

## Summary

The May heartbeat budget-cap fix (deployed 2026-04-12 08:29 UTC) reduced average heartbeat ops from **22.4 → 7.3** (67% reduction), exceeding the projected 47-55% improvement. Compliance rate: **96% within ≤12 op budget**. Heartbeat ops savings: **~740 ops/day** (~$35/day).

## Deployment

- **Commit:** `faf6115b` — "Deploy May heartbeat budget caps — target ≤12 ops (from 22.4 avg)"
- **Deployed:** 2026-04-12T08:29:10Z
- **Measurement window:** 22.4 hours post-deployment (25 heartbeats)

## Before/After Comparison

### Per-Heartbeat Statistics

| Metric | Pre-deployment (48h, n=98) | Post-deployment (22h, n=25) | Change |
|--------|---------------------------|----------------------------|--------|
| **Average ops** | **22.4** | **7.3** | **-67%** |
| Median | 19 | 7 | -63% |
| P25 | 15 | 6 | -60% |
| P75 | 25 | 7 | -72% |
| P90 | 42 | 12 | -71% |
| Min | 3 | 4 | — |
| Max | 94 | 16 | -83% |
| Total ops | 2,192 | 182 | — |

### Budget Compliance

| Metric | Pre | Post |
|--------|-----|------|
| Within ≤12 ops | 12/98 (12%) | **24/25 (96%)** |
| 13-20 ops | 49/98 (50%) | 1/25 (4%) |
| 21+ ops | 37/98 (38%) | 0/25 (0%) |

**One violation:** A single 16-op heartbeat on Apr 12 10:23 UTC (the 2nd heartbeat post-deployment). All subsequent heartbeats were compliant.

### Op Distribution Shift

**Pre-deployment:**
| Bucket | Count | % | Avg ops |
|--------|-------|---|---------|
| 1-10 | 6 | 6% | 7.5 |
| 11-15 | 25 | 26% | 13.3 |
| 16-20 | 24 | 24% | 17.8 |
| 21-30 | 25 | 26% | 24.6 |
| 31-40 | 7 | 7% | 34.7 |
| 41+ | 11 | 11% | 48.1 |

**Post-deployment:**
| Bucket | Count | % | Avg ops |
|--------|-------|---|---------|
| 1-5 | 7 | 28% | 4.9 |
| 6-10 | 17 | 68% | 7.1 |
| 11-15 | 1 | 4% | — |

The entire distribution collapsed into the 1-10 range. The long tail (31+ ops, previously 18% of heartbeats and 33% of ops) is **completely eliminated**.

## Daily Savings

### Heartbeat-Only

| Period | HBs/day | Avg ops | HB ops/day |
|--------|---------|---------|------------|
| Pre-fix (24h) | 50 | 22.4 (actual: 19.9) | 995 |
| Post-fix (24h) | 28* | 7.3 (actual: 9.1) | 255 |
| **Savings** | — | — | **~740 ops/day** |

*Post-fix had a 10h overnight gap (18:23→04:51 UTC). Normalized to active hours, heartbeat frequency is similar (~2/hour vs ~2/hour).

**Note:** The 24h post-fix avg (9.1 per HB) is slightly higher than the 22h post-deploy avg (7.3) because the 24h window includes 3 pre-deployment heartbeats from the window overlap. The true per-heartbeat average post-deployment is **7.3 ops**.

### Total May Agent

| Period | May total ops | HB ops | Work session ops |
|--------|--------------|--------|------------------|
| Apr 10-11 (pre-fix) | 1,197/day | 1,197 | 0 |
| Apr 11-12 (pre-fix) | 1,468/day | 995 | 473 |
| Apr 12-13 (post-fix) | 678/day* | 182 (HB) | 408 (WS) |

*Daily rate from 22h window.

May is now **forking work properly**: 15 work sessions post-deployment (avg 27.2 ops each) vs heartbeats staying lean. Pre-deployment, May did this work inline within heartbeats — that's where the 22.4 avg came from.

### System-Wide Daily Ops Trend

| Date | Daily ops | vs Apr 10 |
|------|-----------|-----------|
| Apr 10 | 9,996 | baseline |
| Apr 11 | 9,028 | -10% |
| Apr 12 | 8,477 | -15% |
| Apr 13 (projected) | ~3,514* | -65% |

*Apr 13 is projected from 6.9h of data (1,013 ops). The low rate may reflect overnight activity patterns rather than pure optimization gains. A 24h measurement is needed for accurate comparison.

## Comparison with Projections

| Metric | Projected | Actual | |
|--------|-----------|--------|-|
| Avg ops reduction | 47-55% | **67%** | ✅ Beat projection |
| Target avg | 10-12 ops | **7.3 ops** | ✅ Under target |
| P90 target | 18-20 | **12** | ✅ Beat projection |
| Daily ops savings | 500-600 | **~740** | ✅ Beat projection |
| Daily cost savings | $25-30 | **~$35** | ✅ Beat projection |

The fix outperformed projections across every metric. The projected 47-55% reduction assumed May would still do some follow-up work inline. Instead, May adopted the budget caps cleanly and shifted inline work to forked sessions.

## Comparison with Other Agent Fixes

| Agent | Pre avg | Post avg | Reduction | Approach |
|-------|---------|----------|-----------|----------|
| Tech-lead | 30.8 | 3.5 | 89% | Full dispatcher rewrite |
| **May** | **22.4** | **7.3** | **67%** | **Budget caps per step** |
| Optimizer | 56 | 23 | 59% | Budget caps + fork rules |
| Bob D-o-R P1 | 31.9 | 9.4 | 71% | P1 budget cap |

May's budget-cap-only approach (no structural changes, KE-008 compliant) achieved the **second-best reduction** after tech-lead's full rewrite. This validates the hypothesis that tightening per-step budgets is effective even without restructuring.

## Key Behavioral Changes Observed

1. **No more session peeking**: Pre-deployment, May peeked multiple sessions per cycle (~5-10 ops). Post: 0 peeks.
2. **No inline git operations**: Pre-deployment, May committed context.md every cycle (2-4 ops). Post: relies on auto-commit cron.
3. **Clean fork discipline**: May now forks work sessions for investigations, audits, and analysis. 15 forks in 22h (avg 27.2 ops) — substantive work properly separated from dispatch.
4. **Fast exit**: 68% of heartbeats complete in 4-7 ops. The system snapshot query + dispatch-board read/write is the dominant pattern.

## Risk Check

- **No information lag observed**: May's dispatch board is still current despite no session peeking — DB queries provide sufficient status data.
- **No dropped tasks**: All 15 forked work sessions completed successfully (status=done).
- **No quality degradation**: May's coordinator role is functioning normally.

## Recommendation

**Mark as DONE.** The fix is validated and holding. No further action needed on May heartbeat bloat. Monitor in next system health check (every 6h) to confirm persistence.

---

*Measurement methodology: Heartbeats identified by `task LIKE '%heartbeat%' AND task NOT LIKE '[WORK SESSION]%'`. Work sessions identified by `task LIKE '[WORK SESSION]%'`. Pre-deployment window: 48h before commit `faf6115b`. Post-deployment window: 22.4h after commit.*
