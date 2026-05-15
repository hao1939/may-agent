# Finding: Coach Session Cost — Current State vs. Apr 10-12 Baseline

**Date**: 2026-04-15 (Evening)
**Author**: Optimizer (Mode C: Skill & Technique Scouting)
**Status**: COMPLETE
**Prior findings**: finding-coach-session-efficiency-0410.md, finding-coach-experiment-cost-scouting-0412.md

---

## Executive Summary

Coach daily op cost has dropped **32%** since the Apr 10-12 baseline, from 1,909 ops/day to 1,288 ops/day, while maintaining the same session count (80/day). The average ops per session fell from 23.9 to 16.2. This improvement is driven by three observable changes:

1. **Zero-op sessions eliminated** — was 50.3% of all sessions historically; now 0% in last 2 days
2. **Tail sessions shrunk** — max ops dropped from 188-252 to 80-118
3. **gym-batch.sh adopted** — 42+ sessions referenced it in the last 7 days across experiments

The projected $35/day savings from the Apr 10 finding appears to have been **partially realized** (~$20-25/day based on the 621 ops/day reduction).

---

## Data: Current State (Apr 14-15) vs. Baseline (Apr 10-12)

| Metric | Apr 10-12 Baseline | Apr 14-15 Current | Change |
|--------|-------------------|-------------------|--------|
| Sessions/day | 80 | 80 | 0% |
| Total ops/day | 1,909 | 1,288 | **-32%** |
| Avg ops/session | 23.9 | 16.2 | **-32%** |
| Median ops | 12 | 12 | 0% |
| Max ops | 188 | 118 | -37% |
| Zero-op sessions | Unknown (historically 50.3%) | 0 | Eliminated |
| Error sessions (3d) | 0 | 1 (0.6%) | Negligible |

### Last 24h Detail (64 sessions)

| Metric | Value |
|--------|-------|
| Total ops | 1,125 |
| Avg ops | 17.6 |
| Median | 14 |
| P75 | 25 |
| P90 | 35 |
| Max | 80 |

### Op Distribution (Last 24h)

| Bucket | Count | % |
|--------|-------|---|
| 1-5 | 12 | 18.8% |
| 6-10 | 14 | 21.9% |
| 11-20 | 17 | 26.6% |
| 21-30 | 12 | 18.8% |
| 31-50 | 5 | 7.8% |
| 51-100 | 4 | 6.3% |
| 100+ | 0 | 0% |

**67% of sessions are ≤20 ops** — a healthy distribution with no extreme bloat.

### By Task Type (Last 24h)

| Type | Count | Avg Ops | Max |
|------|-------|---------|-----|
| Heartbeat | 30 | 7.7 | 18 |
| Work Session | 12 | 32.5 | 80 |
| Cron (non-training) | 9 | 28.0 | 52 |
| Other (coaching, deploy) | 13 | 19.5 | 48 |

Heartbeats at avg 7.7 ops is very close to the Apr 10 baseline of 7.6 — consistent. The improvement is concentrated in **work sessions** (was avg 48.1 for design sessions, now 32.5 overall including execution).

---

## Top 3 Sessions Analysis

### #1: Promoted Skill Regression Check (80 ops, interrupted)
- Ran gym scenarios for 3 promoted skills — a gym-heavy task
- Was interrupted (hit timeout) at 29.5 minutes
- 80 ops is the session max; this is a "run lots of gym scenarios" task that would have been ~130+ ops in the Apr 10 era

### #2: EXP-166 Setup & Smoke Test (59 ops, still running)
- Setting up experiment scenario variants and smoke-testing
- Mix of file creation + gym runs — typical experiment session

### #3: EXP-164 Independence Retest (56 ops, done)
- Running batch gym trials + analysis
- Completed successfully in 15.8 minutes — efficient for a gym-based experiment

**Pattern**: The top sessions are all gym-execution-heavy. The discovery spirals that dominated the Apr 10 finding (32.7% of ops on ls/find/grep) appear to have been reduced.

---

## gym-batch.sh Adoption

The gym-batch.sh script (recommended in both prior findings) **exists and is actively used**:

- **42+ sessions** in the last 7 days reference gym-batch in their task descriptions
- Sessions span experiments EXP-147, EXP-151, EXP-152, EXP-153, EXP-155, EXP-156, EXP-164, EXP-165, EXP-166
- Usage appears natural — embedded in work session tasks dispatched by Bob

**Impact estimate**: The reduction from serial gym-run invocations (2-4 ops each) to batch execution (1-2 ops total) explains a significant portion of the ops reduction in experiment sessions. A 10-run experiment that previously cost ~30 gym ops now costs ~2-5 ops.

---

## What Changed Since Apr 10-12

### Changes That Worked
1. **gym-batch.sh built and adopted** — Single biggest technique improvement. Collapsed N×3 ops → ~2 ops for gym execution.
2. **Zero-op sessions eliminated** — The "50.3% of sessions produce 0 ops" problem from Apr 10 is gone. Sessions now always do at least a few ops (min=2), suggesting the fast-exit path was improved without wasting 322s per empty session.
3. **Tail compression** — No sessions >118 ops in last 2 days vs. regular 140-252 op sessions in the baseline period.

### Changes That Didn't Happen (or weren't needed)
1. **State Index** — No evidence of a `agents/coach/workspace/state-index.md` being maintained. The discovery-spiral reduction may have come from other improvements (better context injection, SOUL.md changes) rather than an explicit state index.
2. **Growth-trigger error rate** — The 52% error rate from Apr 10 finding is no longer visible in recent data (0 "growth-trigger" errors in last 2 days, possibly because the trigger was removed or fixed).
3. **Read-then-Act discipline** — No evidence this was explicitly enforced, but the average ops reduction suggests exploration chains are naturally shorter.

---

## Remaining Opportunities

### 1. Experiment Session Cost Floor (~30 ops)
Even with gym-batch, experiment work sessions average 32.5 ops. This is reasonable for design+execute+analyze cycles but could potentially be pushed to ~20-25 ops with pre-specified analysis scripts (the EXP-143 pattern from the Apr 12 finding).

### 2. Regression Check Efficiency
The 80-op regression check (session #1) is the day's most expensive session. A dedicated regression-check script that runs all promoted skill scenarios in one batch could reduce this to ~15-20 ops.

### 3. Cron Session Overhead
The 9 cron sessions at avg 28 ops include common-sense-verify (52, 35 ops) and reflect (30 ops). These are inherently exploratory but could benefit from tighter scope.

---

## Cost Projection

| Period | Sessions/day | Ops/day | Est. $/day (at ~$0.04/op) |
|--------|-------------|---------|--------------------------|
| Apr 10-12 (baseline) | 80 | 1,909 | ~$76 |
| Apr 14-15 (current) | 80 | 1,288 | ~$52 |
| **Savings** | 0 | **621** | **~$25/day** |

The 32% reduction translates to roughly **$25/day savings**, aligning with the projected $35/day from the Apr 10 finding (71% of projected savings realized).

---

## Conclusion

Coach cost reduction is working. The gym-batch.sh technique is the standout success — it was the highest-impact recommendation from both prior findings and has been widely adopted across experiments. The remaining $10/day gap to the original $35/day projection likely requires the state-index and pre-specified-analysis improvements that haven't been implemented yet, but these are diminishing returns — the 32% reduction already captures the majority of the opportunity.

**Verdict**: Coach is no longer the acute cost problem it was on Apr 10. Further optimization should focus on the cron sessions (common-sense-verify, reflect) which are now the proportionally expensive outliers within coach's budget.

---

*Finding produced by Optimizer Mode C (Skill & Technique Scouting), 2026-04-15 Evening*
